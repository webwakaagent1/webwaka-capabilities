import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { MediaAsset, MediaFolder, MediaFilter, MediaType } from '../models/types';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as mimeTypes from 'mime-types';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export class MediaService {
  constructor() {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  async uploadAsset(
    tenantId: string,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    options?: {
      folderId?: string;
      altText?: string;
      caption?: string;
    }
  ): Promise<MediaAsset> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      const ext = path.extname(file.originalname);
      const filename = `${id}${ext}`;
      const mediaType = this.getMediaType(file.mimetype);
      
      const tenantDir = path.join(UPLOAD_DIR, tenantId);
      if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
      }

      const filePath = path.join(tenantDir, filename);
      fs.writeFileSync(filePath, file.buffer);

      const url = `/media/${tenantId}/${filename}`;
      let thumbnailUrl: string | undefined;
      let width: number | undefined;
      let height: number | undefined;

      const result = await client.query(
        `INSERT INTO media_assets 
         (id, tenant_id, filename, original_filename, mime_type, media_type, size, width, height, url, thumbnail_url, alt_text, caption, folder_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          id,
          tenantId,
          filename,
          file.originalname,
          file.mimetype,
          mediaType,
          file.size,
          width || null,
          height || null,
          url,
          thumbnailUrl || null,
          options?.altText || null,
          options?.caption || null,
          options?.folderId || null,
          JSON.stringify({}),
        ]
      );

      const asset = this.mapRowToMediaAsset(result.rows[0]);
      logger.info('Media asset uploaded', { id: asset.id, tenantId, filename: file.originalname });
      return asset;
    } finally {
      client.release();
    }
  }

  async getAsset(id: string, tenantId: string): Promise<MediaAsset | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM media_assets WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      return result.rows.length > 0 ? this.mapRowToMediaAsset(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async listAssets(filter: MediaFilter, limit = 100, offset = 0): Promise<MediaAsset[]> {
    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM media_assets WHERE tenant_id = $1';
      const values: any[] = [filter.tenantId];
      let paramCount = 2;

      if (filter.mediaType) {
        query += ` AND media_type = $${paramCount++}`;
        values.push(filter.mediaType);
      }
      if (filter.folderId) {
        query += ` AND folder_id = $${paramCount++}`;
        values.push(filter.folderId);
      }
      if (filter.search) {
        query += ` AND (original_filename ILIKE $${paramCount} OR alt_text ILIKE $${paramCount})`;
        values.push(`%${filter.search}%`);
        paramCount++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
      values.push(limit, offset);

      const result = await client.query(query, values);
      return result.rows.map(this.mapRowToMediaAsset);
    } finally {
      client.release();
    }
  }

  async updateAsset(
    id: string, 
    tenantId: string, 
    updates: Partial<Pick<MediaAsset, 'altText' | 'caption' | 'folderId'>>
  ): Promise<MediaAsset | null> {
    const client = await pool.connect();
    try {
      const setClauses: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.altText !== undefined) {
        setClauses.push(`alt_text = $${paramCount++}`);
        values.push(updates.altText);
      }
      if (updates.caption !== undefined) {
        setClauses.push(`caption = $${paramCount++}`);
        values.push(updates.caption);
      }
      if (updates.folderId !== undefined) {
        setClauses.push(`folder_id = $${paramCount++}`);
        values.push(updates.folderId);
      }

      values.push(id, tenantId);
      const result = await client.query(
        `UPDATE media_assets SET ${setClauses.join(', ')}
         WHERE id = $${paramCount++} AND tenant_id = $${paramCount}
         RETURNING *`,
        values
      );

      return result.rows.length > 0 ? this.mapRowToMediaAsset(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async deleteAsset(id: string, tenantId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const asset = await this.getAsset(id, tenantId);
      if (!asset) return false;

      const filePath = path.join(UPLOAD_DIR, tenantId, asset.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      const result = await client.query(
        'DELETE FROM media_assets WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      
      if (result.rowCount && result.rowCount > 0) {
        logger.info('Media asset deleted', { id, tenantId });
        return true;
      }
      return false;
    } finally {
      client.release();
    }
  }

  async createFolder(tenantId: string, name: string, parentId?: string): Promise<MediaFolder> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      let folderPath = `/${name}`;

      if (parentId) {
        const parentResult = await client.query(
          'SELECT path FROM media_folders WHERE id = $1 AND tenant_id = $2',
          [parentId, tenantId]
        );
        if (parentResult.rows.length > 0) {
          folderPath = `${parentResult.rows[0].path}/${name}`;
        }
      }

      const result = await client.query(
        `INSERT INTO media_folders (id, tenant_id, name, parent_id, path)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, tenantId, name, parentId || null, folderPath]
      );

      const folder = this.mapRowToMediaFolder(result.rows[0]);
      logger.info('Media folder created', { id: folder.id, tenantId, path: folderPath });
      return folder;
    } finally {
      client.release();
    }
  }

  async listFolders(tenantId: string, parentId?: string): Promise<MediaFolder[]> {
    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM media_folders WHERE tenant_id = $1';
      const values: any[] = [tenantId];

      if (parentId) {
        query += ' AND parent_id = $2';
        values.push(parentId);
      } else {
        query += ' AND parent_id IS NULL';
      }

      query += ' ORDER BY name ASC';
      const result = await client.query(query, values);
      return result.rows.map(this.mapRowToMediaFolder);
    } finally {
      client.release();
    }
  }

  async deleteFolder(id: string, tenantId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM media_folders WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      
      if (result.rowCount && result.rowCount > 0) {
        logger.info('Media folder deleted', { id, tenantId });
        return true;
      }
      return false;
    } finally {
      client.release();
    }
  }

  private getMediaType(mimeType: string): MediaType {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  private mapRowToMediaAsset(row: any): MediaAsset {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      filename: row.filename,
      originalFilename: row.original_filename,
      mimeType: row.mime_type,
      mediaType: row.media_type,
      size: row.size,
      width: row.width,
      height: row.height,
      duration: row.duration,
      url: row.url,
      thumbnailUrl: row.thumbnail_url,
      altText: row.alt_text,
      caption: row.caption,
      folderId: row.folder_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToMediaFolder(row: any): MediaFolder {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      parentId: row.parent_id,
      path: row.path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const mediaService = new MediaService();
