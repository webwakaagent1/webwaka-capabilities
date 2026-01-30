import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { Location, CreateLocationInput } from '../types';
import { AuditService } from './AuditService';

export class LocationService {
  private auditService = new AuditService();

  async create(input: CreateLocationInput, performedBy: string): Promise<Location> {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO cb4_locations 
       (id, tenant_id, code, name, location_type, address, parent_location_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, input.tenantId, input.code, input.name, input.locationType, 
       input.address || null, input.parentLocationId || null]
    );

    const location = this.mapRow(result.rows[0]);
    await this.auditService.log(
      input.tenantId, 'location', id, 'create', performedBy,
      undefined, this.toAuditState(location)
    );

    return location;
  }

  async getById(tenantId: string, id: string): Promise<Location | null> {
    const result = await pool.query(
      'SELECT * FROM cb4_locations WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async getByCode(tenantId: string, code: string): Promise<Location | null> {
    const result = await pool.query(
      'SELECT * FROM cb4_locations WHERE code = $1 AND tenant_id = $2',
      [code, tenantId]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async list(
    tenantId: string,
    filters?: { locationType?: string; isActive?: boolean; parentLocationId?: string }
  ): Promise<Location[]> {
    let query = 'SELECT * FROM cb4_locations WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters?.locationType) {
      query += ` AND location_type = $${paramIndex++}`;
      params.push(filters.locationType);
    }
    if (filters?.isActive !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      params.push(filters.isActive);
    }
    if (filters?.parentLocationId) {
      query += ` AND parent_location_id = $${paramIndex++}`;
      params.push(filters.parentLocationId);
    }

    query += ' ORDER BY name ASC';
    const result = await pool.query(query, params);
    return result.rows.map(this.mapRow);
  }

  async update(
    tenantId: string,
    id: string,
    updates: Partial<Omit<Location, 'id' | 'tenantId' | 'createdAt'>>,
    performedBy: string
  ): Promise<Location | null> {
    const existing = await this.getById(tenantId, id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.address !== undefined) {
      fields.push(`address = $${paramIndex++}`);
      values.push(updates.address);
    }
    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (fields.length === 0) return existing;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, tenantId);

    const result = await pool.query(
      `UPDATE cb4_locations SET ${fields.join(', ')} 
       WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
       RETURNING *`,
      values
    );

    const updated = this.mapRow(result.rows[0]);
    await this.auditService.log(
      tenantId, 'location', id, 'update', performedBy,
      this.toAuditState(existing), this.toAuditState(updated)
    );

    return updated;
  }

  private mapRow(row: Record<string, unknown>): Location {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      code: row.code as string,
      name: row.name as string,
      locationType: row.location_type as 'warehouse' | 'store' | 'distribution_center' | 'virtual',
      address: row.address as string | undefined,
      isActive: row.is_active as boolean,
      parentLocationId: row.parent_location_id as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private toAuditState(location: Location): Record<string, unknown> {
    return { ...location };
  }
}
