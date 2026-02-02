/**
 * Retry Engine Tests
 * 
 * Tests for FD-2026-003 Section 2.4 compliance
 */

import { RetryEngine } from '../src/sync/RetryEngine';
import { Transaction, TransactionStatus, OperationType } from '../src/queue/TransactionTypes';

describe('RetryEngine', () => {
  let retryEngine: RetryEngine;

  beforeEach(() => {
    retryEngine = new RetryEngine();
  });

  const createMockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    transaction_id: 'test-id',
    created_at: new Date().toISOString(),
    operation_type: OperationType.CREATE,
    entity_type: 'test',
    entity_id: 'test-1',
    payload: {},
    status: TransactionStatus.FAILED,
    retry_count: 0,
    last_attempt_at: new Date().toISOString(),
    error_code: null,
    error_message: null,
    client_version: '1.0.0',
    schema_version: '1.0',
    ...overrides
  });

  describe('shouldRetry', () => {
    it('should allow retry when under max retries', () => {
      const transaction = createMockTransaction({ retry_count: 5 });
      expect(retryEngine.shouldRetry(transaction)).toBe(true);
    });

    it('should not allow retry when max retries reached per FD-2026-003', () => {
      const transaction = createMockTransaction({ retry_count: 10 });
      expect(retryEngine.shouldRetry(transaction)).toBe(false);
    });

    it('should not allow retry when max retries exceeded', () => {
      const transaction = createMockTransaction({ retry_count: 15 });
      expect(retryEngine.shouldRetry(transaction)).toBe(false);
    });

    it('should not allow retry when retry window exceeded', () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      const transaction = createMockTransaction({
        created_at: oldDate.toISOString(),
        retry_count: 5
      });
      expect(retryEngine.shouldRetry(transaction)).toBe(false);
    });
  });

  describe('calculateBackoffMs', () => {
    it('should calculate exponential backoff per FD-2026-003', () => {
      // Base 2 exponential backoff
      expect(retryEngine.calculateBackoffMs(0)).toBe(1000); // 2^0 = 1 second
      expect(retryEngine.calculateBackoffMs(1)).toBe(2000); // 2^1 = 2 seconds
      expect(retryEngine.calculateBackoffMs(2)).toBe(4000); // 2^2 = 4 seconds
      expect(retryEngine.calculateBackoffMs(3)).toBe(8000); // 2^3 = 8 seconds
    });

    it('should cap backoff at 5 minutes per FD-2026-003', () => {
      const maxBackoff = 5 * 60 * 1000; // 5 minutes
      expect(retryEngine.calculateBackoffMs(10)).toBe(maxBackoff);
      expect(retryEngine.calculateBackoffMs(20)).toBe(maxBackoff);
    });
  });

  describe('getNextRetryTime', () => {
    it('should calculate next retry time correctly', () => {
      const now = Date.now();
      const transaction = createMockTransaction({
        retry_count: 2,
        last_attempt_at: new Date(now).toISOString()
      });

      const nextRetry = retryEngine.getNextRetryTime(transaction);
      expect(nextRetry).not.toBeNull();
      
      if (nextRetry) {
        const expectedDelay = 4000; // 2^2 seconds
        const actualDelay = nextRetry.getTime() - now;
        expect(actualDelay).toBeCloseTo(expectedDelay, -2); // Within 100ms
      }
    });

    it('should return null when retry not allowed', () => {
      const transaction = createMockTransaction({ retry_count: 10 });
      expect(retryEngine.getNextRetryTime(transaction)).toBeNull();
    });
  });

  describe('isReadyForRetry', () => {
    it('should return false when backoff period not elapsed', () => {
      const transaction = createMockTransaction({
        retry_count: 1,
        last_attempt_at: new Date().toISOString()
      });
      expect(retryEngine.isReadyForRetry(transaction)).toBe(false);
    });

    it('should return true when backoff period elapsed', () => {
      const pastTime = new Date(Date.now() - 10000); // 10 seconds ago
      const transaction = createMockTransaction({
        retry_count: 1,
        last_attempt_at: pastTime.toISOString()
      });
      expect(retryEngine.isReadyForRetry(transaction)).toBe(true);
    });
  });

  describe('getRetryStats', () => {
    it('should return comprehensive retry statistics', () => {
      const transaction = createMockTransaction({ retry_count: 3 });
      const stats = retryEngine.getRetryStats(transaction);

      expect(stats.retries_used).toBe(3);
      expect(stats.retries_remaining).toBe(7);
      expect(stats.can_retry).toBe(true);
      expect(stats.within_retry_window).toBe(true);
      expect(stats.next_retry_at).not.toBeNull();
      expect(stats.time_until_next_retry_ms).not.toBeNull();
    });

    it('should show no retries remaining when max reached', () => {
      const transaction = createMockTransaction({ retry_count: 10 });
      const stats = retryEngine.getRetryStats(transaction);

      expect(stats.retries_used).toBe(10);
      expect(stats.retries_remaining).toBe(0);
      expect(stats.can_retry).toBe(false);
    });
  });

  describe('hasExceededRetryWindow', () => {
    it('should return false within 24-hour window', () => {
      const transaction = createMockTransaction({
        created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      });
      expect(retryEngine.hasExceededRetryWindow(transaction)).toBe(false);
    });

    it('should return true after 24-hour window per FD-2026-003', () => {
      const transaction = createMockTransaction({
        created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      });
      expect(retryEngine.hasExceededRetryWindow(transaction)).toBe(true);
    });
  });
});
