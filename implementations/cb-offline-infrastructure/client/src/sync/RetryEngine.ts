/**
 * Retry Engine - FD-2026-003 Section 2.4 Compliant
 * 
 * Implements exponential backoff retry logic for failed sync operations
 * with configurable parameters per FD-2026-003 specifications.
 */

import { Transaction } from '../queue/TransactionTypes';
import { RetryConfig, DEFAULT_RETRY_CONFIG } from './SyncTypes';

export class RetryEngine {
  private config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Check if a transaction should be retried
   * Per FD-2026-003: Max 10 retries within 24-hour window
   */
  shouldRetry(transaction: Transaction): boolean {
    // Check if max retries exceeded
    if (transaction.retry_count >= this.config.maxRetries) {
      return false;
    }

    // Check if within retry window
    const createdAt = new Date(transaction.created_at).getTime();
    const now = Date.now();
    const elapsedMs = now - createdAt;

    if (elapsedMs > this.config.maxRetryWindowMs) {
      return false;
    }

    return true;
  }

  /**
   * Calculate backoff delay for next retry
   * Per FD-2026-003: Exponential backoff (base 2, max 5 minutes)
   */
  calculateBackoffMs(retryCount: number): number {
    // Exponential backoff: delay = base^retryCount seconds
    const delaySeconds = Math.pow(this.config.backoffBase, retryCount);
    const delayMs = delaySeconds * 1000;

    // Cap at maximum backoff
    return Math.min(delayMs, this.config.maxBackoffMs);
  }

  /**
   * Get next retry time for a transaction
   */
  getNextRetryTime(transaction: Transaction): Date | null {
    if (!this.shouldRetry(transaction)) {
      return null;
    }

    const lastAttempt = transaction.last_attempt_at 
      ? new Date(transaction.last_attempt_at).getTime()
      : new Date(transaction.created_at).getTime();

    const backoffMs = this.calculateBackoffMs(transaction.retry_count);
    const nextRetryTime = new Date(lastAttempt + backoffMs);

    return nextRetryTime;
  }

  /**
   * Check if a transaction is ready for retry (backoff period elapsed)
   */
  isReadyForRetry(transaction: Transaction): boolean {
    const nextRetryTime = this.getNextRetryTime(transaction);
    
    if (!nextRetryTime) {
      return false;
    }

    return Date.now() >= nextRetryTime.getTime();
  }

  /**
   * Get time remaining until next retry (in milliseconds)
   */
  getTimeUntilNextRetry(transaction: Transaction): number | null {
    const nextRetryTime = this.getNextRetryTime(transaction);
    
    if (!nextRetryTime) {
      return null;
    }

    const remaining = nextRetryTime.getTime() - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Check if transaction has exceeded retry window
   */
  hasExceededRetryWindow(transaction: Transaction): boolean {
    const createdAt = new Date(transaction.created_at).getTime();
    const now = Date.now();
    const elapsedMs = now - createdAt;

    return elapsedMs > this.config.maxRetryWindowMs;
  }

  /**
   * Get retry statistics for a transaction
   */
  getRetryStats(transaction: Transaction): {
    retries_used: number;
    retries_remaining: number;
    can_retry: boolean;
    next_retry_at: Date | null;
    time_until_next_retry_ms: number | null;
    within_retry_window: boolean;
  } {
    return {
      retries_used: transaction.retry_count,
      retries_remaining: Math.max(0, this.config.maxRetries - transaction.retry_count),
      can_retry: this.shouldRetry(transaction),
      next_retry_at: this.getNextRetryTime(transaction),
      time_until_next_retry_ms: this.getTimeUntilNextRetry(transaction),
      within_retry_window: !this.hasExceededRetryWindow(transaction)
    };
  }

  /**
   * Update retry configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}
