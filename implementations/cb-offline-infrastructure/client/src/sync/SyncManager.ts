/**
 * Sync Manager - FD-2026-003 Compliant Implementation
 * 
 * Orchestrates the complete sync-on-reconnect process including:
 * - Reconnection detection with stabilization
 * - Automatic sync initiation
 * - Conflict resolution
 * - Retry logic with exponential backoff
 * - Progress tracking and user notification
 */

import { TransactionQueue } from '../queue/TransactionQueue';
import { Transaction, TransactionStatus } from '../queue/TransactionTypes';
import { ConflictResolver, ServerEntity } from './ConflictResolver';
import { RetryEngine } from './RetryEngine';
import {
  SyncStatus,
  SyncProgress,
  SyncResult,
  TransactionSyncResult,
  SyncEvent,
  SyncEventType,
  SyncEventCallback,
  ReconnectionConfig,
  RetryConfig,
  ConflictStrategy,
  DEFAULT_RECONNECTION_CONFIG
} from './SyncTypes';

export interface SyncManagerConfig {
  queue: TransactionQueue;
  reconnectionConfig: ReconnectionConfig;
  retryConfig?: Partial<RetryConfig>;
  conflictStrategy?: ConflictStrategy;
  syncEndpoint: string;
  debug?: boolean;
}

export class SyncManager {
  private queue: TransactionQueue;
  private conflictResolver: ConflictResolver;
  private retryEngine: RetryEngine;
  private reconnectionConfig: ReconnectionConfig;
  private syncEndpoint: string;
  private debug: boolean;

  private status: SyncStatus = SyncStatus.IDLE;
  private eventCallbacks: SyncEventCallback[] = [];
  private connectionStableTimer: NodeJS.Timeout | null = null;
  private isOnline: boolean = false;

  constructor(config: SyncManagerConfig) {
    this.queue = config.queue;
    this.reconnectionConfig = {
      ...DEFAULT_RECONNECTION_CONFIG,
      ...config.reconnectionConfig
    } as ReconnectionConfig;
    this.retryEngine = new RetryEngine(config.retryConfig);
    this.conflictResolver = new ConflictResolver(
      config.conflictStrategy || ConflictStrategy.SERVER_WINS
    );
    this.syncEndpoint = config.syncEndpoint;
    this.debug = config.debug || false;
  }

  /**
   * Initialize sync manager and start monitoring connection
   */
  async initialize(): Promise<void> {
    // Set up network status listeners (browser environment)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkStatusChange(true));
      window.addEventListener('offline', () => this.handleNetworkStatusChange(false));
      
      // Check initial status
      this.isOnline = navigator.onLine;
    }

    if (this.debug) {
      console.log('[SyncManager] Initialized, online status:', this.isOnline);
    }
  }

  /**
   * Register event callback for sync events
   */
  on(callback: SyncEventCallback): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Remove event callback
   */
  off(callback: SyncEventCallback): void {
    this.eventCallbacks = this.eventCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Manually trigger sync (for testing or user-initiated sync)
   */
  async triggerSync(): Promise<SyncResult> {
    if (this.status === SyncStatus.SYNCING) {
      throw new Error('Sync already in progress');
    }

    return await this.performSync();
  }

  /**
   * Handle network status change
   * Per FD-2026-003 Section 2.1: Two-factor reconnection detection
   */
  private async handleNetworkStatusChange(online: boolean): Promise<void> {
    this.isOnline = online;

    if (online) {
      this.emitEvent({
        type: SyncEventType.RECONNECTION_DETECTED,
        timestamp: new Date().toISOString()
      });

      // Start stabilization period
      this.status = SyncStatus.DETECTING_CONNECTION;
      
      // Clear any existing timer
      if (this.connectionStableTimer) {
        clearTimeout(this.connectionStableTimer);
      }

      // Verify connection with health check
      const isHealthy = await this.performHealthCheck();
      
      if (!isHealthy) {
        if (this.debug) {
          console.log('[SyncManager] Health check failed, not initiating sync');
        }
        this.status = SyncStatus.IDLE;
        return;
      }

      // Per FD-2026-003 Section 2.2: 5-second stabilization delay
      this.status = SyncStatus.STABILIZING;
      this.emitEvent({
        type: SyncEventType.STABILIZATION_STARTED,
        timestamp: new Date().toISOString()
      });

      this.connectionStableTimer = setTimeout(async () => {
        // Verify still online after stabilization
        if (this.isOnline && await this.performHealthCheck()) {
          await this.performSync();
        } else {
          this.status = SyncStatus.IDLE;
        }
      }, this.reconnectionConfig.stabilizationDelayMs);
    } else {
      // Connection lost
      if (this.connectionStableTimer) {
        clearTimeout(this.connectionStableTimer);
        this.connectionStableTimer = null;
      }
      this.status = SyncStatus.IDLE;
    }
  }

  /**
   * Perform health check to verify stable connection
   * Per FD-2026-003 Section 2.1
   */
  private async performHealthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.reconnectionConfig.healthCheckTimeoutMs
      );

      const response = await fetch(this.reconnectionConfig.healthCheckUrl, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeout);
      return response.ok;
    } catch (error) {
      if (this.debug) {
        console.log('[SyncManager] Health check failed:', error);
      }
      return false;
    }
  }

  /**
   * Perform the actual sync operation
   * Per FD-2026-003: Process all pending transactions with retry logic
   */
  private async performSync(): Promise<SyncResult> {
    const startTime = Date.now();
    this.status = SyncStatus.SYNCING;

    this.emitEvent({
      type: SyncEventType.SYNC_STARTED,
      timestamp: new Date().toISOString()
    });

    const transactionResults: TransactionSyncResult[] = [];
    let succeeded = 0;
    let failed = 0;
    let conflictsDetected = 0;
    let conflictsResolved = 0;

    try {
      // Get all pending and failed transactions
      const pendingTransactions = await this.queue.getPendingTransactions();
      const failedTransactions = await this.queue.getFailedTransactions();
      
      // Filter failed transactions that are ready for retry
      const retryableTransactions = failedTransactions.filter(tx => 
        this.retryEngine.isReadyForRetry(tx)
      );

      const allTransactions = [...pendingTransactions, ...retryableTransactions];
      const total = allTransactions.length;

      if (this.debug) {
        console.log(`[SyncManager] Starting sync: ${total} transactions`);
      }

      // Process each transaction
      for (let i = 0; i < allTransactions.length; i++) {
        const transaction = allTransactions[i];
        
        // Emit progress
        this.emitEvent({
          type: SyncEventType.TRANSACTION_SYNCED,
          timestamp: new Date().toISOString(),
          transaction_id: transaction.transaction_id,
          progress: {
            status: SyncStatus.SYNCING,
            total,
            synced: i,
            failed,
            conflicts: conflictsDetected,
            current_transaction_id: transaction.transaction_id
          }
        });

        try {
          const result = await this.syncTransaction(transaction);
          transactionResults.push(result);

          if (result.success) {
            succeeded++;
            await this.queue.markSucceeded(transaction.transaction_id);
          } else {
            failed++;
            
            if (result.conflict) {
              conflictsDetected++;
              conflictsResolved++;
            }

            // Check if should retry or move to dead letter
            if (this.retryEngine.shouldRetry(transaction)) {
              await this.queue.markFailed(
                transaction.transaction_id,
                result.error_code || 'SYNC_FAILED',
                result.error_message || 'Unknown sync error'
              );
            } else {
              await this.queue.moveToDeadLetter(
                transaction.transaction_id,
                'Max retries exceeded'
              );
            }

            this.emitEvent({
              type: SyncEventType.TRANSACTION_FAILED,
              timestamp: new Date().toISOString(),
              transaction_id: transaction.transaction_id,
              error: result.error_message
            });
          }
        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          transactionResults.push({
            transaction_id: transaction.transaction_id,
            success: false,
            error_code: 'SYNC_ERROR',
            error_message: errorMessage
          });

          this.emitEvent({
            type: SyncEventType.TRANSACTION_FAILED,
            timestamp: new Date().toISOString(),
            transaction_id: transaction.transaction_id,
            error: errorMessage
          });
        }
      }

      const endTime = Date.now();
      const result: SyncResult = {
        success: failed === 0,
        total_attempted: total,
        succeeded,
        failed,
        conflicts_detected: conflictsDetected,
        conflicts_resolved: conflictsResolved,
        transaction_results: transactionResults,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date(endTime).toISOString(),
        duration_ms: endTime - startTime
      };

      this.status = SyncStatus.COMPLETED;
      this.emitEvent({
        type: SyncEventType.SYNC_COMPLETED,
        timestamp: new Date().toISOString(),
        progress: {
          status: SyncStatus.COMPLETED,
          total,
          synced: succeeded,
          failed,
          conflicts: conflictsDetected
        }
      });

      if (this.debug) {
        console.log('[SyncManager] Sync completed:', result);
      }

      return result;

    } catch (error) {
      this.status = SyncStatus.FAILED;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.emitEvent({
        type: SyncEventType.SYNC_FAILED,
        timestamp: new Date().toISOString(),
        error: errorMessage
      });

      throw error;
    } finally {
      // Reset to idle after a delay
      setTimeout(() => {
        if (this.status !== SyncStatus.SYNCING) {
          this.status = SyncStatus.IDLE;
        }
      }, 1000);
    }
  }

  /**
   * Sync a single transaction with the server
   */
  private async syncTransaction(transaction: Transaction): Promise<TransactionSyncResult> {
    try {
      // Mark as in progress
      await this.queue.markInProgress(transaction.transaction_id);

      // Send to server
      const response = await fetch(this.syncEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transaction,
          client_timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          transaction_id: transaction.transaction_id,
          success: false,
          error_code: errorData.code || 'HTTP_ERROR',
          error_message: errorData.message || `HTTP ${response.status}`
        };
      }

      const serverResponse = await response.json();

      // Check for conflicts
      if (serverResponse.conflict) {
        const serverEntity: ServerEntity = serverResponse.server_entity;
        const conflictResult = await this.conflictResolver.resolveConflict(
          transaction,
          serverEntity
        );

        if (conflictResult.has_conflict) {
          this.emitEvent({
            type: SyncEventType.CONFLICT_DETECTED,
            timestamp: new Date().toISOString(),
            transaction_id: transaction.transaction_id,
            conflict: conflictResult.conflict
          });

          return {
            transaction_id: transaction.transaction_id,
            success: false,
            error_code: 'CONFLICT',
            error_message: 'Conflict detected and resolved',
            conflict: conflictResult.conflict
          };
        }
      }

      return {
        transaction_id: transaction.transaction_id,
        success: true
      };

    } catch (error) {
      return {
        transaction_id: transaction.transaction_id,
        success: false,
        error_code: 'NETWORK_ERROR',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Emit event to all registered callbacks
   */
  private emitEvent(event: SyncEvent): void {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        if (this.debug) {
          console.error('[SyncManager] Error in event callback:', error);
        }
      }
    });
  }

  /**
   * Get conflict audit log
   */
  getConflictAuditLog() {
    return this.conflictResolver.getAuditLog();
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.connectionStableTimer) {
      clearTimeout(this.connectionStableTimer);
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', () => this.handleNetworkStatusChange(true));
      window.removeEventListener('offline', () => this.handleNetworkStatusChange(false));
    }
  }
}
