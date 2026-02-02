/**
 * Sync Types - FD-2026-003 Compliant
 * 
 * Defines types and interfaces for the sync-on-reconnect system
 * as specified in FD-2026-003: Sync-On-Reconnect Is Mandatory.
 */

import { Transaction } from '../queue/TransactionTypes';

/**
 * Conflict resolution strategies
 */
export enum ConflictStrategy {
  SERVER_WINS = 'SERVER_WINS',
  CLIENT_WINS = 'CLIENT_WINS',
  MANUAL = 'MANUAL'
}

/**
 * Sync status
 */
export enum SyncStatus {
  IDLE = 'IDLE',
  DETECTING_CONNECTION = 'DETECTING_CONNECTION',
  STABILIZING = 'STABILIZING',
  SYNCING = 'SYNCING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

/**
 * Conflict detection result
 */
export interface Conflict {
  transaction_id: string;
  entity_type: string;
  entity_id: string;
  client_version: string;
  server_version: string;
  client_timestamp: string;
  server_timestamp: string;
  resolution: ConflictStrategy;
  resolved_at: string;
}

/**
 * Sync progress information
 */
export interface SyncProgress {
  status: SyncStatus;
  total: number;
  synced: number;
  failed: number;
  conflicts: number;
  current_transaction_id?: string;
}

/**
 * Sync result for a single transaction
 */
export interface TransactionSyncResult {
  transaction_id: string;
  success: boolean;
  error_code?: string;
  error_message?: string;
  conflict?: Conflict;
}

/**
 * Overall sync result
 */
export interface SyncResult {
  success: boolean;
  total_attempted: number;
  succeeded: number;
  failed: number;
  conflicts_detected: number;
  conflicts_resolved: number;
  transaction_results: TransactionSyncResult[];
  started_at: string;
  completed_at: string;
  duration_ms: number;
}

/**
 * Retry configuration per FD-2026-003 Section 2.4
 */
export interface RetryConfig {
  /** Maximum number of retries per transaction (default: 10) */
  maxRetries: number;
  
  /** Base for exponential backoff in seconds (default: 2) */
  backoffBase: number;
  
  /** Maximum backoff delay in milliseconds (default: 5 minutes) */
  maxBackoffMs: number;
  
  /** Maximum retry window in milliseconds (default: 24 hours) */
  maxRetryWindowMs: number;
}

/**
 * Default retry configuration per FD-2026-003
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 10,
  backoffBase: 2,
  maxBackoffMs: 5 * 60 * 1000, // 5 minutes
  maxRetryWindowMs: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * Reconnection detection configuration per FD-2026-003 Section 2.1
 */
export interface ReconnectionConfig {
  /** Minimum stable connection duration in milliseconds (default: 5000ms) */
  stabilizationDelayMs: number;
  
  /** Health check endpoint URL */
  healthCheckUrl: string;
  
  /** Health check timeout in milliseconds */
  healthCheckTimeoutMs: number;
}

/**
 * Default reconnection configuration per FD-2026-003
 */
export const DEFAULT_RECONNECTION_CONFIG: Partial<ReconnectionConfig> = {
  stabilizationDelayMs: 5000,
  healthCheckTimeoutMs: 3000
};

/**
 * Sync event types for callbacks
 */
export enum SyncEventType {
  RECONNECTION_DETECTED = 'RECONNECTION_DETECTED',
  STABILIZATION_STARTED = 'STABILIZATION_STARTED',
  SYNC_STARTED = 'SYNC_STARTED',
  TRANSACTION_SYNCED = 'TRANSACTION_SYNCED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  CONFLICT_DETECTED = 'CONFLICT_DETECTED',
  SYNC_COMPLETED = 'SYNC_COMPLETED',
  SYNC_FAILED = 'SYNC_FAILED'
}

/**
 * Sync event payload
 */
export interface SyncEvent {
  type: SyncEventType;
  timestamp: string;
  progress?: SyncProgress;
  transaction_id?: string;
  error?: string;
  conflict?: Conflict;
}

/**
 * Sync event callback
 */
export type SyncEventCallback = (event: SyncEvent) => void;
