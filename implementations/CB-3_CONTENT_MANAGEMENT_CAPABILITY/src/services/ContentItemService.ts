import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { 
  ContentItem, 
  ContentVersion, 
  CreateContentItemInput, 
  UpdateContentItemInput,
  ContentFilter,
  ContentStatus 
} from '../models/types';
import { contentTypeService } from './ContentTypeService';
import { v4 as uuidv4 } from 'uuid';

export class ContentItemService {
  async createContentItem(input: CreateContentItemInput): Promise<ContentItem> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const contentType = await contentTypeService.getContentType(input.contentTypeId, input.tenantId);
      if (!contentType) {
        throw new Error('Content type not found');
      }

      const id = uuidv4();
      const result = await client.query(
        `INSERT INTO content_items 
         (id, tenant_id, content_type_id, slug, title, status, data, localized_data, author_id, current_version)
         VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, 1)
         RETURNING *`,
        [
          id,
          input.tenantId,
          input.contentTypeId,
          input.slug,
          input.title,
          JSON.stringify(input.data),
          JSON.stringify(input.localizedData || {}),
          input.authorId,
        ]
      );

      await client.query(
        `INSERT INTO content_versions (id, content_item_id, version, data, localized_data, author_id, change_log)
         VALUES ($1, $2, 1, $3, $4, $5, 'Initial version')`,
        [uuidv4(), id, JSON.stringify(input.data), JSON.stringify(input.localizedData || {}), input.authorId]
      );

      await client.query('COMMIT');

      const contentItem = this.mapRowToContentItem(result.rows[0]);
      logger.info('Content item created', { id: contentItem.id, tenantId: input.tenantId, slug: input.slug });
      return contentItem;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getContentItem(id: string, tenantId: string): Promise<ContentItem | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM content_items WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      return result.rows.length > 0 ? this.mapRowToContentItem(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async getContentItemBySlug(tenantId: string, contentTypeId: string, slug: string): Promise<ContentItem | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM content_items WHERE tenant_id = $1 AND content_type_id = $2 AND slug = $3',
        [tenantId, contentTypeId, slug]
      );
      return result.rows.length > 0 ? this.mapRowToContentItem(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async listContentItems(filter: ContentFilter, limit = 100, offset = 0): Promise<ContentItem[]> {
    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM content_items WHERE tenant_id = $1';
      const values: any[] = [filter.tenantId];
      let paramCount = 2;

      if (filter.contentTypeId) {
        query += ` AND content_type_id = $${paramCount++}`;
        values.push(filter.contentTypeId);
      }
      if (filter.status) {
        query += ` AND status = $${paramCount++}`;
        values.push(filter.status);
      }
      if (filter.authorId) {
        query += ` AND author_id = $${paramCount++}`;
        values.push(filter.authorId);
      }
      if (filter.search) {
        query += ` AND (title ILIKE $${paramCount} OR slug ILIKE $${paramCount})`;
        values.push(`%${filter.search}%`);
        paramCount++;
      }

      query += ` ORDER BY updated_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
      values.push(limit, offset);

      const result = await client.query(query, values);
      return result.rows.map(this.mapRowToContentItem);
    } finally {
      client.release();
    }
  }

  async updateContentItem(
    id: string, 
    tenantId: string, 
    input: UpdateContentItemInput, 
    authorId: string
  ): Promise<ContentItem | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await this.getContentItem(id, tenantId);
      if (!existing) {
        await client.query('ROLLBACK');
        return null;
      }

      const newVersion = existing.currentVersion + 1;
      const newData = input.data !== undefined ? input.data : existing.data;
      const newLocalizedData = input.localizedData !== undefined ? input.localizedData : existing.localizedData;

      const setClauses: string[] = ['updated_at = NOW()', `current_version = ${newVersion}`];
      const values: any[] = [];
      let paramCount = 1;

      if (input.title !== undefined) {
        setClauses.push(`title = $${paramCount++}`);
        values.push(input.title);
      }
      if (input.slug !== undefined) {
        setClauses.push(`slug = $${paramCount++}`);
        values.push(input.slug);
      }
      if (input.data !== undefined) {
        setClauses.push(`data = $${paramCount++}`);
        values.push(JSON.stringify(input.data));
      }
      if (input.localizedData !== undefined) {
        setClauses.push(`localized_data = $${paramCount++}`);
        values.push(JSON.stringify(input.localizedData));
      }

      values.push(id, tenantId);
      const result = await client.query(
        `UPDATE content_items SET ${setClauses.join(', ')}
         WHERE id = $${paramCount++} AND tenant_id = $${paramCount}
         RETURNING *`,
        values
      );

      await client.query(
        `INSERT INTO content_versions (id, content_item_id, version, data, localized_data, author_id, change_log)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          uuidv4(),
          id,
          newVersion,
          JSON.stringify(newData),
          JSON.stringify(newLocalizedData),
          authorId,
          input.changeLog || null,
        ]
      );

      await client.query('COMMIT');
      return result.rows.length > 0 ? this.mapRowToContentItem(result.rows[0]) : null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateStatus(id: string, tenantId: string, status: ContentStatus): Promise<ContentItem | null> {
    const client = await pool.connect();
    try {
      const updates: any = { status };
      if (status === 'published') {
        const existing = await this.getContentItem(id, tenantId);
        if (existing) {
          updates.publishedAt = new Date();
          updates.publishedVersion = existing.currentVersion;
        }
      }

      const result = await client.query(
        `UPDATE content_items 
         SET status = $1, published_at = $2, published_version = $3, updated_at = NOW()
         WHERE id = $4 AND tenant_id = $5
         RETURNING *`,
        [status, updates.publishedAt || null, updates.publishedVersion || null, id, tenantId]
      );

      if (result.rows.length > 0) {
        logger.info('Content status updated', { id, tenantId, status });
        return this.mapRowToContentItem(result.rows[0]);
      }
      return null;
    } finally {
      client.release();
    }
  }

  async getVersions(id: string, tenantId: string): Promise<ContentVersion[]> {
    const client = await pool.connect();
    try {
      const item = await this.getContentItem(id, tenantId);
      if (!item) return [];

      const result = await client.query(
        'SELECT * FROM content_versions WHERE content_item_id = $1 ORDER BY version DESC',
        [id]
      );
      return result.rows.map(this.mapRowToContentVersion);
    } finally {
      client.release();
    }
  }

  async rollbackToVersion(id: string, tenantId: string, version: number, authorId: string): Promise<ContentItem | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const item = await this.getContentItem(id, tenantId);
      if (!item) {
        await client.query('ROLLBACK');
        return null;
      }

      const versionResult = await client.query(
        'SELECT * FROM content_versions WHERE content_item_id = $1 AND version = $2',
        [id, version]
      );

      if (versionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error(`Version ${version} not found`);
      }

      const targetVersion = this.mapRowToContentVersion(versionResult.rows[0]);
      const newVersion = item.currentVersion + 1;

      await client.query(
        `UPDATE content_items 
         SET data = $1, localized_data = $2, current_version = $3, updated_at = NOW()
         WHERE id = $4 AND tenant_id = $5`,
        [JSON.stringify(targetVersion.data), JSON.stringify(targetVersion.localizedData), newVersion, id, tenantId]
      );

      await client.query(
        `INSERT INTO content_versions (id, content_item_id, version, data, localized_data, author_id, change_log)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          uuidv4(),
          id,
          newVersion,
          JSON.stringify(targetVersion.data),
          JSON.stringify(targetVersion.localizedData),
          authorId,
          `Rolled back to version ${version}`,
        ]
      );

      await client.query('COMMIT');
      logger.info('Content rolled back', { id, tenantId, fromVersion: item.currentVersion, toVersion: version });
      return this.getContentItem(id, tenantId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteContentItem(id: string, tenantId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM content_items WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      
      if (result.rowCount && result.rowCount > 0) {
        logger.info('Content item deleted', { id, tenantId });
        return true;
      }
      return false;
    } finally {
      client.release();
    }
  }

  private mapRowToContentItem(row: any): ContentItem {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contentTypeId: row.content_type_id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      data: row.data || {},
      localizedData: row.localized_data || {},
      authorId: row.author_id,
      publishedAt: row.published_at,
      publishedVersion: row.published_version,
      currentVersion: row.current_version,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToContentVersion(row: any): ContentVersion {
    return {
      id: row.id,
      contentItemId: row.content_item_id,
      version: row.version,
      data: row.data || {},
      localizedData: row.localized_data || {},
      authorId: row.author_id,
      changeLog: row.change_log,
      createdAt: row.created_at,
    };
  }
}

export const contentItemService = new ContentItemService();
