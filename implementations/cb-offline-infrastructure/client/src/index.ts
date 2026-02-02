/**
 * @webwaka/offline-client
 * 
 * Offline-First Client Library for WebWaka Platform
 * 
 * Implements FD-2026-001, FD-2026-002, and FD-2026-003:
 * - Offline-first transaction queue with persistence
 * - Automatic sync-on-reconnect
 * - Conflict resolution with audit logging
 * - Exponential backoff retry logic
 * 
 * @packageDocumentation
 */

// Storage
export { IStorageAdapter, StorageConfig } from './storage/StorageInterface';
export { IndexedDBAdapter } from './storage/IndexedDBAdapter';

// Queue
export {
  Transaction,
  TransactionStatus,
  OperationType,
  CreateTransactionConfig,
  QueueStats,
  MAX_QUEUE_SIZE
} from './queue/TransactionTypes';
export { TransactionQueue, TransactionQueueConfig } from './queue/TransactionQueue';

// Sync
export {
  ConflictStrategy,
  SyncStatus,
  Conflict,
  SyncProgress,
  TransactionSyncResult,
  SyncResult,
  RetryConfig,
  ReconnectionConfig,
  SyncEventType,
  SyncEvent,
  SyncEventCallback,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_RECONNECTION_CONFIG
} from './sync/SyncTypes';
export { ConflictResolver, ServerEntity, ConflictResolutionResult } from './sync/ConflictResolver';
export { RetryEngine } from './sync/RetryEngine';
export { SyncManager, SyncManagerConfig } from './sync/SyncManager';

/**
 * Library version
 */
export const VERSION = '1.0.0';

/**
 * Governing invariants implemented
 */
export const IMPLEMENTED_INVARIANTS = [
  'FD-2026-001: Offline-First Is Non-Negotiable',
  'FD-2026-002: Transaction Queue Persistence',
  'FD-2026-003: Sync-On-Reconnect Is Mandatory'
];
