import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { Product, CreateProductInput, InventoryStrategy } from '../types';
import { AuditService } from './AuditService';

export class ProductService {
  private auditService = new AuditService();

  async create(input: CreateProductInput, performedBy: string): Promise<Product> {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO cb4_products 
       (id, tenant_id, sku, name, description, category, unit_of_measure, 
        track_inventory, allow_negative_stock, reorder_point, reorder_quantity, 
        inventory_strategy, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        id, input.tenantId, input.sku, input.name, input.description || null,
        input.category || null, input.unitOfMeasure || 'each',
        input.trackInventory ?? true, input.allowNegativeStock ?? false,
        input.reorderPoint || null, input.reorderQuantity || null,
        input.inventoryStrategy || 'FIFO',
        input.metadata ? JSON.stringify(input.metadata) : null
      ]
    );

    const product = this.mapRow(result.rows[0]);
    await this.auditService.log(
      input.tenantId, 'product', id, 'create', performedBy,
      undefined, this.toAuditState(product)
    );

    return product;
  }

  async getById(tenantId: string, id: string): Promise<Product | null> {
    const result = await pool.query(
      'SELECT * FROM cb4_products WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async getBySku(tenantId: string, sku: string): Promise<Product | null> {
    const result = await pool.query(
      'SELECT * FROM cb4_products WHERE sku = $1 AND tenant_id = $2',
      [sku, tenantId]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async list(
    tenantId: string,
    filters?: { category?: string; isActive?: boolean; trackInventory?: boolean }
  ): Promise<Product[]> {
    let query = 'SELECT * FROM cb4_products WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters?.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(filters.category);
    }
    if (filters?.isActive !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      params.push(filters.isActive);
    }
    if (filters?.trackInventory !== undefined) {
      query += ` AND track_inventory = $${paramIndex++}`;
      params.push(filters.trackInventory);
    }

    query += ' ORDER BY name ASC';
    const result = await pool.query(query, params);
    return result.rows.map(this.mapRow);
  }

  async update(
    tenantId: string,
    id: string,
    updates: Partial<Omit<Product, 'id' | 'tenantId' | 'createdAt'>>,
    performedBy: string
  ): Promise<Product | null> {
    const existing = await this.getById(tenantId, id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(updates.category);
    }
    if (updates.unitOfMeasure !== undefined) {
      fields.push(`unit_of_measure = $${paramIndex++}`);
      values.push(updates.unitOfMeasure);
    }
    if (updates.trackInventory !== undefined) {
      fields.push(`track_inventory = $${paramIndex++}`);
      values.push(updates.trackInventory);
    }
    if (updates.allowNegativeStock !== undefined) {
      fields.push(`allow_negative_stock = $${paramIndex++}`);
      values.push(updates.allowNegativeStock);
    }
    if (updates.reorderPoint !== undefined) {
      fields.push(`reorder_point = $${paramIndex++}`);
      values.push(updates.reorderPoint);
    }
    if (updates.reorderQuantity !== undefined) {
      fields.push(`reorder_quantity = $${paramIndex++}`);
      values.push(updates.reorderQuantity);
    }
    if (updates.inventoryStrategy !== undefined) {
      fields.push(`inventory_strategy = $${paramIndex++}`);
      values.push(updates.inventoryStrategy);
    }
    if (updates.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }
    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (fields.length === 0) return existing;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, tenantId);

    const result = await pool.query(
      `UPDATE cb4_products SET ${fields.join(', ')} 
       WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
       RETURNING *`,
      values
    );

    const updated = this.mapRow(result.rows[0]);
    await this.auditService.log(
      tenantId, 'product', id, 'update', performedBy,
      this.toAuditState(existing), this.toAuditState(updated)
    );

    return updated;
  }

  async delete(tenantId: string, id: string, performedBy: string): Promise<boolean> {
    const existing = await this.getById(tenantId, id);
    if (!existing) return false;

    await pool.query(
      'UPDATE cb4_products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    await this.auditService.log(
      tenantId, 'product', id, 'deactivate', performedBy,
      this.toAuditState(existing), { ...this.toAuditState(existing), isActive: false }
    );

    return true;
  }

  private mapRow(row: Record<string, unknown>): Product {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      sku: row.sku as string,
      name: row.name as string,
      description: row.description as string | undefined,
      category: row.category as string | undefined,
      unitOfMeasure: row.unit_of_measure as string,
      trackInventory: row.track_inventory as boolean,
      allowNegativeStock: row.allow_negative_stock as boolean,
      reorderPoint: row.reorder_point as number | undefined,
      reorderQuantity: row.reorder_quantity as number | undefined,
      inventoryStrategy: row.inventory_strategy as InventoryStrategy,
      metadata: row.metadata as Record<string, unknown> | undefined,
      isActive: row.is_active as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private toAuditState(product: Product): Record<string, unknown> {
    return { ...product };
  }
}
