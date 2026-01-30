import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { InventoryAuditLog } from '../types';

export class AuditService {
  async log(
    tenantId: string,
    entityType: string,
    entityId: string,
    action: string,
    performedBy: string,
    previousState?: Record<string, unknown>,
    newState?: Record<string, unknown>,
    reason?: string
  ): Promise<InventoryAuditLog> {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO cb4_inventory_audit_log 
       (id, tenant_id, entity_type, entity_id, action, previous_state, new_state, performed_by, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, tenantId, entityType, entityId, action, 
       previousState ? JSON.stringify(previousState) : null,
       newState ? JSON.stringify(newState) : null,
       performedBy, reason]
    );
    return this.mapRow(result.rows[0]);
  }

  async getEntityHistory(tenantId: string, entityType: string, entityId: string): Promise<InventoryAuditLog[]> {
    const result = await pool.query(
      `SELECT * FROM cb4_inventory_audit_log 
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
       ORDER BY created_at DESC`,
      [tenantId, entityType, entityId]
    );
    return result.rows.map(this.mapRow);
  }

  async search(
    tenantId: string,
    filters: {
      entityType?: string;
      entityId?: string;
      action?: string;
      performedBy?: string;
      fromDate?: Date;
      toDate?: Date;
    }
  ): Promise<InventoryAuditLog[]> {
    let query = 'SELECT * FROM cb4_inventory_audit_log WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters.entityType) {
      query += ` AND entity_type = $${paramIndex++}`;
      params.push(filters.entityType);
    }
    if (filters.entityId) {
      query += ` AND entity_id = $${paramIndex++}`;
      params.push(filters.entityId);
    }
    if (filters.action) {
      query += ` AND action = $${paramIndex++}`;
      params.push(filters.action);
    }
    if (filters.performedBy) {
      query += ` AND performed_by = $${paramIndex++}`;
      params.push(filters.performedBy);
    }
    if (filters.fromDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(filters.toDate);
    }

    query += ' ORDER BY created_at DESC LIMIT 1000';

    const result = await pool.query(query, params);
    return result.rows.map(this.mapRow);
  }

  private mapRow(row: Record<string, unknown>): InventoryAuditLog {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      entityType: row.entity_type as string,
      entityId: row.entity_id as string,
      action: row.action as string,
      previousState: row.previous_state as Record<string, unknown> | undefined,
      newState: row.new_state as Record<string, unknown> | undefined,
      performedBy: row.performed_by as string,
      reason: row.reason as string | undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}
