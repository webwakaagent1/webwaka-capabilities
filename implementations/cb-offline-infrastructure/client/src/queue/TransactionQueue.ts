/**
 * Transaction Queue - FD-2026-002 Compliant Implementation
 * 
 * Manages the offline transaction queue with full lifecycle management,
 * durability guarantees, and queue size enforcement.
 */

import { v4 as uuidv4 } from 'uuid';
import { IStorageAdapter } from '../storage/StorageInterface';
import {
  Transaction,
  TransactionStatus,
  OperationType,
  CreateTransactionConfig,
  QueueStats,
  MAX_QUEUE_SIZE
} from './TransactionTypes';

export interface TransactionQueueConfig {
  storage: IStorageAdapter;
  maxQueueSize?: number;
  debug?: boolean;
}

export class TransactionQueue {
  private storage: IStorageAdapter;
  private maxQueueSize: number;
  private debug: boolean;

  constructor(config: TransactionQueueConfig) {
    this.storage = config.storage;
    this.maxQueueSize = config.maxQueueSize || MAX_QUEUE_SIZE;
    this.debug = config.debug || false;
  }

  /**
   * Initialize the transaction queue
   */
  async initialize(): Promise<void> {
    await this.storage.initialize();
    if (this.debug) {
      console.log('[TransactionQueue] Initialized successfully');
    }
  }

  /**
   * Create and enqueue a new transaction
   * Enforces queue size limit per FD-2026-002 Section 2.3
   */
  async enqueue(config: CreateTransactionConfig): Promise<string> {
    // Check queue size before adding
    const currentSize = await this.storage.getTransactionCount();
    
    if (currentSize >= this.maxQueueSize) {
      // Move oldest PENDING transaction to DEAD_LETTER to make space
      await this.evictOldestPending();
    }

    const transaction: Transaction = {
      transaction_id: uuidv4(),
      created_at: new Date().toISOString(),
      operation_type: config.operation_type,
      entity_type: config.entity_type,
      entity_id: config.entity_id,
      payload: config.payload,
      status: TransactionStatus.PENDING,
      retry_count: 0,
      last_attempt_at: null,
      error_code: null,
      error_message: null,
      client_version: config.client_version,
      schema_version: config.schema_version
    };

    await this.storage.addTransaction(transaction);

    if (this.debug) {
      console.log(`[TransactionQueue] Transaction enqueued: ${transaction.transaction_id}`);
    }

    return transaction.transaction_id;
  }

  /**
   * Get a transaction by ID
   */
  async getTransaction(transactionId: string): Promise<Transaction | null> {
    return await this.storage.getTransaction(transactionId);
  }

  /**
   * Get all pending transactions
   */
  async getPendingTransactions(limit?: number): Promise<Transaction[]> {
    return await this.storage.getTransactionsByStatus(TransactionStatus.PENDING, limit);
  }

  /**
   * Mark a transaction as in progress
   */
  async markInProgress(transactionId: string): Promise<void> {
    await this.storage.updateTransaction(transactionId, {
      status: TransactionStatus.IN_PROGRESS,
      last_attempt_at: new Date().toISOString()
    });

    if (this.debug) {
      console.log(`[TransactionQueue] Transaction marked IN_PROGRESS: ${transactionId}`);
    }
  }

  /**
   * Mark a transaction as succeeded and remove it from queue
   * Per FD-2026-002 Section 2.3: SUCCEEDED transactions are automatically removed
   */
  async markSucceeded(transactionId: string): Promise<void> {
    await this.storage.deleteTransaction(transactionId);

    if (this.debug) {
      console.log(`[TransactionQueue] Transaction succeeded and removed: ${transactionId}`);
    }
  }

  /**
   * Mark a transaction as failed with error details
   */
  async markFailed(
    transactionId: string,
    errorCode: string,
    errorMessage: string
  ): Promise<void> {
    const transaction = await this.storage.getTransaction(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    await this.storage.updateTransaction(transactionId, {
      status: TransactionStatus.FAILED,
      retry_count: transaction.retry_count + 1,
      last_attempt_at: new Date().toISOString(),
      error_code: errorCode,
      error_message: errorMessage
    });

    if (this.debug) {
      console.log(`[TransactionQueue] Transaction marked FAILED: ${transactionId}`);
    }
  }

  /**
   * Move a transaction to dead letter queue
   * Per FD-2026-002 Section 2.4: Exhausted retries go to DEAD_LETTER
   */
  async moveToDeadLetter(transactionId: string, reason: string): Promise<void> {
    await this.storage.updateTransaction(transactionId, {
      status: TransactionStatus.DEAD_LETTER,
      error_message: reason,
      last_attempt_at: new Date().toISOString()
    });

    if (this.debug) {
      console.log(`[TransactionQueue] Transaction moved to DEAD_LETTER: ${transactionId}`);
    }
  }

  /**
   * Reset a FAILED transaction back to PENDING for retry
   */
  async resetToPending(transactionId: string): Promise<void> {
    await this.storage.updateTransaction(transactionId, {
      status: TransactionStatus.PENDING
    });

    if (this.debug) {
      console.log(`[TransactionQueue] Transaction reset to PENDING: ${transactionId}`);
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const [total, pending, inProgress, succeeded, failed, deadLetter] = await Promise.all([
      this.storage.getTransactionCount(),
      this.storage.getTransactionCountByStatus(TransactionStatus.PENDING),
      this.storage.getTransactionCountByStatus(TransactionStatus.IN_PROGRESS),
      this.storage.getTransactionCountByStatus(TransactionStatus.SUCCEEDED),
      this.storage.getTransactionCountByStatus(TransactionStatus.FAILED),
      this.storage.getTransactionCountByStatus(TransactionStatus.DEAD_LETTER)
    ]);

    return {
      total,
      pending,
      in_progress: inProgress,
      succeeded,
      failed,
      dead_letter: deadLetter
    };
  }

  /**
   * Get all transactions in dead letter queue
   */
  async getDeadLetterTransactions(): Promise<Transaction[]> {
    return await this.storage.getTransactionsByStatus(TransactionStatus.DEAD_LETTER);
  }

  /**
   * Get all failed transactions
   */
  async getFailedTransactions(): Promise<Transaction[]> {
    return await this.storage.getTransactionsByStatus(TransactionStatus.FAILED);
  }

  /**
   * Clear all transactions (use with extreme caution)
   */
  async clearAll(): Promise<void> {
    await this.storage.clearAll();
    if (this.debug) {
      console.log('[TransactionQueue] All transactions cleared');
    }
  }

  /**
   * Close the queue and underlying storage
   */
  async close(): Promise<void> {
    await this.storage.close();
    if (this.debug) {
      console.log('[TransactionQueue] Queue closed');
    }
  }

  /**
   * Evict oldest PENDING transaction to make space
   * Private helper for queue size enforcement
   */
  private async evictOldestPending(): Promise<void> {
    const pending = await this.storage.getTransactionsByStatus(TransactionStatus.PENDING);
    
    if (pending.length === 0) {
      throw new Error('Queue is full and no PENDING transactions available for eviction');
    }

    // Sort by created_at to find oldest
    pending.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const oldest = pending[0];
    await this.moveToDeadLetter(
      oldest.transaction_id,
      'Evicted due to queue size limit'
    );

    if (this.debug) {
      console.log(`[TransactionQueue] Evicted oldest PENDING transaction: ${oldest.transaction_id}`);
    }
  }
}
