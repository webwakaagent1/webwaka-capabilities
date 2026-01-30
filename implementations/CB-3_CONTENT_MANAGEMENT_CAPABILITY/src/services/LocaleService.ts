import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { Locale } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

export class LocaleService {
  async createLocale(
    tenantId: string,
    code: string,
    name: string,
    isDefault = false
  ): Promise<Locale> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (isDefault) {
        await client.query(
          'UPDATE locales SET is_default = FALSE WHERE tenant_id = $1',
          [tenantId]
        );
      }

      const id = uuidv4();
      const result = await client.query(
        `INSERT INTO locales (id, tenant_id, code, name, is_default, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         RETURNING *`,
        [id, tenantId, code, name, isDefault]
      );

      await client.query('COMMIT');
      const locale = this.mapRowToLocale(result.rows[0]);
      logger.info('Locale created', { id: locale.id, tenantId, code });
      return locale;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getLocale(id: string, tenantId: string): Promise<Locale | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM locales WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      return result.rows.length > 0 ? this.mapRowToLocale(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async getLocaleByCode(tenantId: string, code: string): Promise<Locale | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM locales WHERE tenant_id = $1 AND code = $2',
        [tenantId, code]
      );
      return result.rows.length > 0 ? this.mapRowToLocale(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async getDefaultLocale(tenantId: string): Promise<Locale | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM locales WHERE tenant_id = $1 AND is_default = TRUE',
        [tenantId]
      );
      return result.rows.length > 0 ? this.mapRowToLocale(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async listLocales(tenantId: string, activeOnly = true): Promise<Locale[]> {
    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM locales WHERE tenant_id = $1';
      if (activeOnly) {
        query += ' AND is_active = TRUE';
      }
      query += ' ORDER BY is_default DESC, name ASC';

      const result = await client.query(query, [tenantId]);
      return result.rows.map(this.mapRowToLocale);
    } finally {
      client.release();
    }
  }

  async updateLocale(
    id: string,
    tenantId: string,
    updates: Partial<Pick<Locale, 'name' | 'isDefault' | 'isActive'>>
  ): Promise<Locale | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (updates.isDefault) {
        await client.query(
          'UPDATE locales SET is_default = FALSE WHERE tenant_id = $1',
          [tenantId]
        );
      }

      const setClauses: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramCount++}`);
        values.push(updates.name);
      }
      if (updates.isDefault !== undefined) {
        setClauses.push(`is_default = $${paramCount++}`);
        values.push(updates.isDefault);
      }
      if (updates.isActive !== undefined) {
        setClauses.push(`is_active = $${paramCount++}`);
        values.push(updates.isActive);
      }

      values.push(id, tenantId);
      const result = await client.query(
        `UPDATE locales SET ${setClauses.join(', ')}
         WHERE id = $${paramCount++} AND tenant_id = $${paramCount}
         RETURNING *`,
        values
      );

      await client.query('COMMIT');
      return result.rows.length > 0 ? this.mapRowToLocale(result.rows[0]) : null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteLocale(id: string, tenantId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const locale = await this.getLocale(id, tenantId);
      if (!locale) return false;
      if (locale.isDefault) {
        throw new Error('Cannot delete the default locale');
      }

      const result = await client.query(
        'DELETE FROM locales WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      
      if (result.rowCount && result.rowCount > 0) {
        logger.info('Locale deleted', { id, tenantId });
        return true;
      }
      return false;
    } finally {
      client.release();
    }
  }

  private mapRowToLocale(row: any): Locale {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code,
      name: row.name,
      isDefault: row.is_default,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const localeService = new LocaleService();
