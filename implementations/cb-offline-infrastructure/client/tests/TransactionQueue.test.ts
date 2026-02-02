/**
 * Transaction Queue Tests
 * 
 * Tests for FD-2026-002 compliance
 */

import { TransactionQueue } from '../src/queue/TransactionQueue';
import { OperationType, TransactionStatus } from '../src/queue/TransactionTypes';
import { IStorageAdapter } from '../src/storage/StorageInterface';
import { Transaction } from '../src/queue/TransactionTypes';

// Mock storage adapter for testing
class MockStorageAdapter implements IStorageAdapter {
  private transactions: Map<string, Transaction> = new Map();

  async initialize(): Promise<void> {}

  async addTransaction(transaction: Transaction): Promise<void> {
    this.transactions.set(transaction.transaction_id, transaction);
  }

  async getTransaction(transactionId: string): Promise<Transaction | null> {
    return this.transactions.get(transactionId) || null;
  }

  async getTransactionsByStatus(status: TransactionStatus, limit?: number): Promise<Transaction[]> {
    const filtered = Array.from(this.transactions.values())
      .filter(t => t.status === status);
    return limit ? filtered.slice(0, limit) : filtered;
  }

  async updateTransaction(transactionId: string, updates: Partial<Transaction>): Promise<void> {
    const existing = this.transactions.get(transactionId);
    if (existing) {
      this.transactions.set(transactionId, { ...existing, ...updates });
    }
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    this.transactions.delete(transactionId);
  }

  async getTransactionCount(): Promise<number> {
    return this.transactions.size;
  }

  async getTransactionCountByStatus(status: TransactionStatus): Promise<number> {
    return Array.from(this.transactions.values())
      .filter(t => t.status === status).length;
  }

  async getAllTransactions(limit?: number, offset?: number): Promise<Transaction[]> {
    let results = Array.from(this.transactions.values());
    if (offset) results = results.slice(offset);
    if (limit) results = results.slice(0, limit);
    return results;
  }

  async clearAll(): Promise<void> {
    this.transactions.clear();
  }

  async close(): Promise<void> {}
}

describe('TransactionQueue', () => {
  let queue: TransactionQueue;
  let storage: MockStorageAdapter;

  beforeEach(async () => {
    storage = new MockStorageAdapter();
    queue = new TransactionQueue({ storage });
    await queue.initialize();
  });

  describe('enqueue', () => {
    it('should create and enqueue a transaction', async () => {
      const transactionId = await queue.enqueue({
        operation_type: OperationType.CREATE,
        entity_type: 'document',
        entity_id: 'doc-1',
        payload: { title: 'Test' },
        client_version: '1.0.0',
        schema_version: '1.0'
      });

      expect(transactionId).toBeDefined();
      expect(typeof transactionId).toBe('string');

      const transaction = await queue.getTransaction(transactionId);
      expect(transaction).not.toBeNull();
      expect(transaction?.status).toBe(TransactionStatus.PENDING);
      expect(transaction?.operation_type).toBe(OperationType.CREATE);
    });

    it('should set all required fields per FD-2026-002', async () => {
      const transactionId = await queue.enqueue({
        operation_type: OperationType.UPDATE,
        entity_type: 'task',
        entity_id: 'task-1',
        payload: { status: 'completed' },
        client_version: '1.0.0',
        schema_version: '1.0'
      });

      const transaction = await queue.getTransaction(transactionId);
      
      expect(transaction?.transaction_id).toBeDefined();
      expect(transaction?.created_at).toBeDefined();
      expect(transaction?.operation_type).toBe(OperationType.UPDATE);
      expect(transaction?.entity_type).toBe('task');
      expect(transaction?.entity_id).toBe('task-1');
      expect(transaction?.payload).toEqual({ status: 'completed' });
      expect(transaction?.status).toBe(TransactionStatus.PENDING);
      expect(transaction?.retry_count).toBe(0);
      expect(transaction?.last_attempt_at).toBeNull();
      expect(transaction?.error_code).toBeNull();
      expect(transaction?.error_message).toBeNull();
      expect(transaction?.client_version).toBe('1.0.0');
      expect(transaction?.schema_version).toBe('1.0');
    });
  });

  describe('lifecycle management', () => {
    it('should transition through lifecycle states', async () => {
      const transactionId = await queue.enqueue({
        operation_type: OperationType.CREATE,
        entity_type: 'document',
        entity_id: 'doc-1',
        payload: { title: 'Test' },
        client_version: '1.0.0',
        schema_version: '1.0'
      });

      // PENDING -> IN_PROGRESS
      await queue.markInProgress(transactionId);
      let transaction = await queue.getTransaction(transactionId);
      expect(transaction?.status).toBe(TransactionStatus.IN_PROGRESS);
      expect(transaction?.last_attempt_at).toBeDefined();

      // IN_PROGRESS -> FAILED
      await queue.markFailed(transactionId, 'TEST_ERROR', 'Test error message');
      transaction = await queue.getTransaction(transactionId);
      expect(transaction?.status).toBe(TransactionStatus.FAILED);
      expect(transaction?.retry_count).toBe(1);
      expect(transaction?.error_code).toBe('TEST_ERROR');
      expect(transaction?.error_message).toBe('Test error message');
    });

    it('should remove transaction on success per FD-2026-002', async () => {
      const transactionId = await queue.enqueue({
        operation_type: OperationType.CREATE,
        entity_type: 'document',
        entity_id: 'doc-1',
        payload: { title: 'Test' },
        client_version: '1.0.0',
        schema_version: '1.0'
      });

      await queue.markSucceeded(transactionId);
      const transaction = await queue.getTransaction(transactionId);
      expect(transaction).toBeNull();
    });

    it('should move to dead letter queue', async () => {
      const transactionId = await queue.enqueue({
        operation_type: OperationType.CREATE,
        entity_type: 'document',
        entity_id: 'doc-1',
        payload: { title: 'Test' },
        client_version: '1.0.0',
        schema_version: '1.0'
      });

      await queue.moveToDeadLetter(transactionId, 'Max retries exceeded');
      const transaction = await queue.getTransaction(transactionId);
      expect(transaction?.status).toBe(TransactionStatus.DEAD_LETTER);
      expect(transaction?.error_message).toBe('Max retries exceeded');
    });
  });

  describe('queue statistics', () => {
    it('should return accurate statistics', async () => {
      // Create multiple transactions
      const id1 = await queue.enqueue({
        operation_type: OperationType.CREATE,
        entity_type: 'doc',
        entity_id: 'doc-1',
        payload: {},
        client_version: '1.0.0',
        schema_version: '1.0'
      });

      const id2 = await queue.enqueue({
        operation_type: OperationType.UPDATE,
        entity_type: 'doc',
        entity_id: 'doc-2',
        payload: {},
        client_version: '1.0.0',
        schema_version: '1.0'
      });

      await queue.markInProgress(id1);
      await queue.markFailed(id2, 'ERROR', 'Failed');

      const stats = await queue.getStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(0);
      expect(stats.in_progress).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });

  describe('queue size enforcement per FD-2026-002', () => {
    it('should enforce maximum queue size', async () => {
      const smallQueue = new TransactionQueue({
        storage,
        maxQueueSize: 3
      });
      await smallQueue.initialize();

      // Fill queue to limit
      await smallQueue.enqueue({
        operation_type: OperationType.CREATE,
        entity_type: 'doc',
        entity_id: 'doc-1',
        payload: {},
        client_version: '1.0.0',
        schema_version: '1.0'
      });

      await smallQueue.enqueue({
        operation_type: OperationType.CREATE,
        entity_type: 'doc',
        entity_id: 'doc-2',
        payload: {},
        client_version: '1.0.0',
        schema_version: '1.0'
      });

      await smallQueue.enqueue({
        operation_type: OperationType.CREATE,
        entity_type: 'doc',
        entity_id: 'doc-3',
        payload: {},
        client_version: '1.0.0',
        schema_version: '1.0'
      });

      // Adding one more should evict oldest
      await smallQueue.enqueue({
        operation_type: OperationType.CREATE,
        entity_type: 'doc',
        entity_id: 'doc-4',
        payload: {},
        client_version: '1.0.0',
        schema_version: '1.0'
      });

      const stats = await smallQueue.getStats();
      expect(stats.total).toBe(3);
      expect(stats.dead_letter).toBe(1);
    });
  });
});
