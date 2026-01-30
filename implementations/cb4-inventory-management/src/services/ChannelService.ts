import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { Channel, ChannelSubscription, CreateChannelInput, CreateSubscriptionInput, ChannelType, SubscriptionStatus, EventType } from '../types';
import { AuditService } from './AuditService';

export class ChannelService {
  private auditService = new AuditService();

  async createChannel(input: CreateChannelInput, performedBy: string): Promise<Channel> {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO cb4_channels 
       (id, tenant_id, code, name, channel_type, webhook_url, api_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, input.tenantId, input.code, input.name, input.channelType,
       input.webhookUrl || null, input.apiKey || null]
    );

    const channel = this.mapChannel(result.rows[0]);
    await this.auditService.log(
      input.tenantId, 'channel', id, 'create', performedBy,
      undefined, { id, code: input.code, name: input.name, channelType: input.channelType }
    );

    return channel;
  }

  async getChannelById(tenantId: string, id: string): Promise<Channel | null> {
    const result = await pool.query(
      'SELECT * FROM cb4_channels WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows.length > 0 ? this.mapChannel(result.rows[0]) : null;
  }

  async getChannelByCode(tenantId: string, code: string): Promise<Channel | null> {
    const result = await pool.query(
      'SELECT * FROM cb4_channels WHERE code = $1 AND tenant_id = $2',
      [code, tenantId]
    );
    return result.rows.length > 0 ? this.mapChannel(result.rows[0]) : null;
  }

  async listChannels(tenantId: string, filters?: { channelType?: ChannelType; isActive?: boolean }): Promise<Channel[]> {
    let query = 'SELECT * FROM cb4_channels WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters?.channelType) {
      query += ` AND channel_type = $${paramIndex++}`;
      params.push(filters.channelType);
    }
    if (filters?.isActive !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      params.push(filters.isActive);
    }

    query += ' ORDER BY name ASC';
    const result = await pool.query(query, params);
    return result.rows.map(this.mapChannel);
  }

  async updateChannel(
    tenantId: string,
    id: string,
    updates: Partial<Omit<Channel, 'id' | 'tenantId' | 'createdAt'>>,
    performedBy: string
  ): Promise<Channel | null> {
    const existing = await this.getChannelById(tenantId, id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.webhookUrl !== undefined) {
      fields.push(`webhook_url = $${paramIndex++}`);
      values.push(updates.webhookUrl);
    }
    if (updates.apiKey !== undefined) {
      fields.push(`api_key = $${paramIndex++}`);
      values.push(updates.apiKey);
    }
    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (fields.length === 0) return existing;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, tenantId);

    const result = await pool.query(
      `UPDATE cb4_channels SET ${fields.join(', ')} 
       WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
       RETURNING *`,
      values
    );

    const updated = this.mapChannel(result.rows[0]);
    await this.auditService.log(
      tenantId, 'channel', id, 'update', performedBy,
      { ...existing }, { ...updated }
    );

    return updated;
  }

  async createSubscription(input: CreateSubscriptionInput, performedBy: string): Promise<ChannelSubscription> {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO cb4_channel_subscriptions 
       (id, tenant_id, channel_id, product_id, location_id, event_types)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, input.tenantId, input.channelId, input.productId || null,
       input.locationId || null, JSON.stringify(input.eventTypes)]
    );

    const subscription = this.mapSubscription(result.rows[0]);
    await this.auditService.log(
      input.tenantId, 'subscription', id, 'create', performedBy,
      undefined, { channelId: input.channelId, eventTypes: input.eventTypes }
    );

    return subscription;
  }

  async getSubscription(tenantId: string, id: string): Promise<ChannelSubscription | null> {
    const result = await pool.query(
      'SELECT * FROM cb4_channel_subscriptions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows.length > 0 ? this.mapSubscription(result.rows[0]) : null;
  }

  async listSubscriptions(
    tenantId: string,
    filters?: { channelId?: string; productId?: string; status?: SubscriptionStatus }
  ): Promise<ChannelSubscription[]> {
    let query = 'SELECT * FROM cb4_channel_subscriptions WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters?.channelId) {
      query += ` AND channel_id = $${paramIndex++}`;
      params.push(filters.channelId);
    }
    if (filters?.productId) {
      query += ` AND product_id = $${paramIndex++}`;
      params.push(filters.productId);
    }
    if (filters?.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    return result.rows.map(this.mapSubscription);
  }

  async updateSubscriptionStatus(
    tenantId: string,
    id: string,
    status: SubscriptionStatus,
    performedBy: string
  ): Promise<ChannelSubscription | null> {
    const existing = await this.getSubscription(tenantId, id);
    if (!existing) return null;

    await pool.query(
      `UPDATE cb4_channel_subscriptions SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3`,
      [status, id, tenantId]
    );

    await this.auditService.log(
      tenantId, 'subscription', id, 'status_change', performedBy,
      { status: existing.status }, { status }
    );

    return this.getSubscription(tenantId, id);
  }

  async deleteSubscription(tenantId: string, id: string, performedBy: string): Promise<boolean> {
    const existing = await this.getSubscription(tenantId, id);
    if (!existing) return false;

    await pool.query(
      'DELETE FROM cb4_channel_subscriptions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    await this.auditService.log(
      tenantId, 'subscription', id, 'delete', performedBy,
      { ...existing }, undefined
    );

    return true;
  }

  private mapChannel(row: Record<string, unknown>): Channel {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      code: row.code as string,
      name: row.name as string,
      channelType: row.channel_type as ChannelType,
      webhookUrl: row.webhook_url as string | undefined,
      apiKey: row.api_key as string | undefined,
      isActive: row.is_active as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapSubscription(row: Record<string, unknown>): ChannelSubscription {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      channelId: row.channel_id as string,
      productId: row.product_id as string | undefined,
      locationId: row.location_id as string | undefined,
      eventTypes: row.event_types as EventType[],
      status: row.status as SubscriptionStatus,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
