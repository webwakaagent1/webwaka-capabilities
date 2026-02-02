/**
 * Conflict Resolver - FD-2026-003 Section 2.3 Compliant
 * 
 * Handles conflict detection and resolution during synchronization
 * using version vectors and configurable strategies.
 */

import { Transaction } from '../queue/TransactionTypes';
import { Conflict, ConflictStrategy } from './SyncTypes';

/**
 * Server entity representation for conflict detection
 */
export interface ServerEntity {
  entity_id: string;
  entity_type: string;
  version: string;
  last_modified: string;
  data: Record<string, any>;
}

/**
 * Conflict resolution result
 */
export interface ConflictResolutionResult {
  has_conflict: boolean;
  conflict?: Conflict;
  resolved_data?: Record<string, any>;
}

export class ConflictResolver {
  private defaultStrategy: ConflictStrategy;
  private auditLog: Conflict[];

  constructor(defaultStrategy: ConflictStrategy = ConflictStrategy.SERVER_WINS) {
    this.defaultStrategy = defaultStrategy;
    this.auditLog = [];
  }

  /**
   * Detect and resolve conflicts between client transaction and server entity
   * Per FD-2026-003 Section 2.3: Uses version vector and last_modified timestamp
   */
  async resolveConflict(
    transaction: Transaction,
    serverEntity: ServerEntity | null
  ): Promise<ConflictResolutionResult> {
    // No conflict if entity doesn't exist on server (new entity)
    if (!serverEntity) {
      return { has_conflict: false };
    }

    // Extract client version from payload (if available)
    const clientVersion = transaction.payload.version || transaction.schema_version;
    const serverVersion = serverEntity.version;

    // Detect conflict: versions differ
    const hasVersionConflict = clientVersion !== serverVersion;

    // Also check timestamps
    const clientTimestamp = transaction.created_at;
    const serverTimestamp = serverEntity.last_modified;
    const hasTimestampConflict = 
      new Date(serverTimestamp).getTime() > new Date(clientTimestamp).getTime();

    if (!hasVersionConflict && !hasTimestampConflict) {
      return { has_conflict: false };
    }

    // Conflict detected - apply resolution strategy
    const conflict: Conflict = {
      transaction_id: transaction.transaction_id,
      entity_type: transaction.entity_type,
      entity_id: transaction.entity_id,
      client_version: clientVersion,
      server_version: serverVersion,
      client_timestamp: clientTimestamp,
      server_timestamp: serverTimestamp,
      resolution: this.defaultStrategy,
      resolved_at: new Date().toISOString()
    };

    // Apply resolution strategy
    let resolvedData: Record<string, any>;

    switch (this.defaultStrategy) {
      case ConflictStrategy.SERVER_WINS:
        // Server data takes precedence (default per FD-2026-003)
        resolvedData = serverEntity.data;
        break;

      case ConflictStrategy.CLIENT_WINS:
        // Client data takes precedence
        resolvedData = transaction.payload;
        break;

      case ConflictStrategy.MANUAL:
        // Manual resolution required - return both versions
        resolvedData = {
          client_data: transaction.payload,
          server_data: serverEntity.data,
          requires_manual_resolution: true
        };
        break;

      default:
        // Fallback to server-wins
        resolvedData = serverEntity.data;
    }

    // Add to audit log per FD-2026-003 Section 2.3
    this.auditLog.push(conflict);

    return {
      has_conflict: true,
      conflict,
      resolved_data: resolvedData
    };
  }

  /**
   * Get conflict audit log
   * Per FD-2026-003 Section 2.3: All conflicts must be audited
   */
  getAuditLog(): Conflict[] {
    return [...this.auditLog];
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * Get conflicts for a specific entity
   */
  getConflictsForEntity(entityType: string, entityId: string): Conflict[] {
    return this.auditLog.filter(
      c => c.entity_type === entityType && c.entity_id === entityId
    );
  }

  /**
   * Set default resolution strategy
   */
  setDefaultStrategy(strategy: ConflictStrategy): void {
    this.defaultStrategy = strategy;
  }

  /**
   * Get current default strategy
   */
  getDefaultStrategy(): ConflictStrategy {
    return this.defaultStrategy;
  }
}
