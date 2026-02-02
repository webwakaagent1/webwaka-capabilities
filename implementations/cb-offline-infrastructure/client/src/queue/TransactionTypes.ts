/**
 * Transaction Types - FD-2026-002 Compliant
 * 
 * This module defines the data structures for the offline transaction queue
 * as specified in FD-2026-002: Transaction Queue Persistence.
 */

/**
 * Operation types for transactions
 */
export enum OperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  COMMAND = 'COMMAND'
}

/**
 * Transaction status lifecycle states
 */
export enum TransactionStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER'
}

/**
 * Transaction record structure as per FD-2026-002 Section 2.2
 */
export interface Transaction {
  /** Client-generated unique identifier (UUID v4) */
  transaction_id: string;
  
  /** Timestamp when the transaction was created (ISO-8601) */
  created_at: string;
  
  /** Type of operation */
  operation_type: OperationType;
  
  /** Type of entity being modified */
  entity_type: string;
  
  /** Unique identifier of the entity */
  entity_id: string;
  
  /** Immutable JSON payload containing operation data */
  payload: Record<string, any>;
  
  /** Current status of the transaction */
  status: TransactionStatus;
  
  /** Number of retry attempts */
  retry_count: number;
  
  /** Timestamp of last processing attempt (ISO-8601) */
  last_attempt_at: string | null;
  
  /** Error code if transaction failed */
  error_code: string | null;
  
  /** Human-readable error message if transaction failed */
  error_message: string | null;
  
  /** Version of the client application */
  client_version: string;
  
  /** Schema version of the payload */
  schema_version: string;
}

/**
 * Configuration for creating a new transaction
 */
export interface CreateTransactionConfig {
  operation_type: OperationType;
  entity_type: string;
  entity_id: string;
  payload: Record<string, any>;
  client_version: string;
  schema_version: string;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  total: number;
  pending: number;
  in_progress: number;
  succeeded: number;
  failed: number;
  dead_letter: number;
}

/**
 * Maximum queue size as per FD-2026-002 Section 2.3
 */
export const MAX_QUEUE_SIZE = 10000;
