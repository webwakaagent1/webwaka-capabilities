/**
 * Server-side types for offline-first infrastructure
 */

/**
 * Transaction from client (matches client-side Transaction type)
 */
export interface ClientTransaction {
  transaction_id: string;
  created_at: string;
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'COMMAND';
  entity_type: string;
  entity_id: string;
  payload: Record<string, any>;
  status: string;
  retry_count: number;
  last_attempt_at: string | null;
  error_code: string | null;
  error_message: string | null;
  client_version: string;
  schema_version: string;
}

/**
 * Sync request from client
 */
export interface SyncRequest {
  transaction: ClientTransaction;
  client_timestamp: string;
}

/**
 * Server entity for conflict detection
 */
export interface ServerEntity {
  entity_id: string;
  entity_type: string;
  version: string;
  last_modified: string;
  data: Record<string, any>;
}

/**
 * Sync response to client
 */
export interface SyncResponse {
  success: boolean;
  transaction_id: string;
  conflict?: boolean;
  server_entity?: ServerEntity;
  error_code?: string;
  error_message?: string;
  server_timestamp: string;
}

/**
 * Dead letter queue entry
 */
export interface DeadLetterEntry {
  transaction_id: string;
  transaction: ClientTransaction;
  reason: string;
  moved_at: string;
  retry_count: number;
}

/**
 * Sync statistics
 */
export interface SyncStats {
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  conflicts_detected: number;
  dead_letter_count: number;
  average_sync_duration_ms: number;
}
