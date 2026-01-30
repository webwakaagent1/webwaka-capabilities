import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { ContentType, CreateContentTypeInput, FieldDefinition } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

export class ContentTypeService {
  async createContentType(input: CreateContentTypeInput): Promise<ContentType> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      this.validateFields(input.fields);

      const result = await client.query(
        `INSERT INTO content_types (id, tenant_id, name, slug, description, fields)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, input.tenantId, input.name, input.slug, input.description || null, JSON.stringify(input.fields)]
      );

      const contentType = this.mapRowToContentType(result.rows[0]);
      logger.info('Content type created', { id: contentType.id, tenantId: input.tenantId, slug: input.slug });
      return contentType;
    } finally {
      client.release();
    }
  }

  async getContentType(id: string, tenantId: string): Promise<ContentType | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM content_types WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      return result.rows.length > 0 ? this.mapRowToContentType(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async getContentTypeBySlug(tenantId: string, slug: string): Promise<ContentType | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM content_types WHERE tenant_id = $1 AND slug = $2',
        [tenantId, slug]
      );
      return result.rows.length > 0 ? this.mapRowToContentType(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async listContentTypes(tenantId: string, limit = 100, offset = 0): Promise<ContentType[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM content_types 
         WHERE tenant_id = $1 OR tenant_id = 'system'
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [tenantId, limit, offset]
      );
      return result.rows.map(this.mapRowToContentType);
    } finally {
      client.release();
    }
  }

  async updateContentType(
    id: string, 
    tenantId: string, 
    updates: Partial<Pick<ContentType, 'name' | 'description' | 'fields'>>
  ): Promise<ContentType | null> {
    const client = await pool.connect();
    try {
      const existing = await this.getContentType(id, tenantId);
      if (!existing) return null;
      if (existing.isSystem) {
        throw new Error('Cannot modify system content types');
      }

      if (updates.fields) {
        this.validateFields(updates.fields);
      }

      const setClauses: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramCount++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramCount++}`);
        values.push(updates.description);
      }
      if (updates.fields !== undefined) {
        setClauses.push(`fields = $${paramCount++}`);
        values.push(JSON.stringify(updates.fields));
      }

      values.push(id, tenantId);
      const result = await client.query(
        `UPDATE content_types SET ${setClauses.join(', ')}
         WHERE id = $${paramCount++} AND tenant_id = $${paramCount}
         RETURNING *`,
        values
      );

      return result.rows.length > 0 ? this.mapRowToContentType(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async deleteContentType(id: string, tenantId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const existing = await this.getContentType(id, tenantId);
      if (!existing) return false;
      if (existing.isSystem) {
        throw new Error('Cannot delete system content types');
      }

      const result = await client.query(
        'DELETE FROM content_types WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      
      if (result.rowCount && result.rowCount > 0) {
        logger.info('Content type deleted', { id, tenantId });
        return true;
      }
      return false;
    } finally {
      client.release();
    }
  }

  private validateFields(fields: FieldDefinition[]): void {
    const validTypes = ['text', 'richtext', 'number', 'boolean', 'date', 'datetime', 'select', 'multiselect', 'media', 'reference', 'json'];
    const names = new Set<string>();

    for (const field of fields) {
      if (!field.name || !field.type || !field.label) {
        throw new Error('Each field must have name, type, and label');
      }
      if (!validTypes.includes(field.type)) {
        throw new Error(`Invalid field type: ${field.type}`);
      }
      if (names.has(field.name)) {
        throw new Error(`Duplicate field name: ${field.name}`);
      }
      names.add(field.name);
    }
  }

  private mapRowToContentType(row: any): ContentType {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      fields: row.fields || [],
      isSystem: row.is_system,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const contentTypeService = new ContentTypeService();
