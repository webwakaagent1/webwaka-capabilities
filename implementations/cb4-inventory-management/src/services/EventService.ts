import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { InventoryEvent, EventType, ChannelSubscription } from '../types';
import { logger } from '../utils/logger';

export class EventService {
  async emit(
    tenantId: string,
    eventType: EventType,
    payload: Record<string, unknown>
  ): Promise<InventoryEvent> {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO cb4_inventory_events 
       (id, tenant_id, event_type, product_id, location_id, channel_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id, tenantId, eventType,
        payload.productId || null,
        payload.locationId || null,
        payload.channelId || null,
        JSON.stringify(payload)
      ]
    );

    const event = this.mapRow(result.rows[0]);

    this.notifySubscribers(tenantId, event).catch(err => {
      logger.error('Failed to notify subscribers', { error: err.message, eventId: id });
    });

    return event;
  }

  async getEvents(
    tenantId: string,
    filters?: { eventType?: EventType; productId?: string; locationId?: string; fromDate?: Date; toDate?: Date }
  ): Promise<InventoryEvent[]> {
    let query = 'SELECT * FROM cb4_inventory_events WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters?.eventType) {
      query += ` AND event_type = $${paramIndex++}`;
      params.push(filters.eventType);
    }
    if (filters?.productId) {
      query += ` AND product_id = $${paramIndex++}`;
      params.push(filters.productId);
    }
    if (filters?.locationId) {
      query += ` AND location_id = $${paramIndex++}`;
      params.push(filters.locationId);
    }
    if (filters?.fromDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(filters.fromDate);
    }
    if (filters?.toDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(filters.toDate);
    }

    query += ' ORDER BY created_at DESC LIMIT 1000';
    const result = await pool.query(query, params);
    return result.rows.map(this.mapRow);
  }

  private async notifySubscribers(tenantId: string, event: InventoryEvent): Promise<void> {
    const subscriptions = await this.getMatchingSubscriptions(tenantId, event);

    for (const subscription of subscriptions) {
      const channel = await this.getChannelById(tenantId, subscription.channelId);
      if (!channel?.webhookUrl) continue;

      try {
        const response = await fetch(channel.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event.eventType,
            'X-Webhook-Signature': this.generateSignature(event, channel.apiKey),
          },
          body: JSON.stringify({
            eventId: event.id,
            eventType: event.eventType,
            tenantId: event.tenantId,
            payload: event.payload,
            timestamp: event.createdAt.toISOString(),
          }),
        });

        if (!response.ok) {
          logger.warn('Webhook delivery failed', { 
            channelId: channel.id, 
            status: response.status,
            eventId: event.id 
          });
        }
      } catch (error) {
        logger.error('Webhook delivery error', { 
          channelId: channel.id, 
          error: (error as Error).message,
          eventId: event.id 
        });
      }
    }

    await pool.query(
      'UPDATE cb4_inventory_events SET processed_at = CURRENT_TIMESTAMP WHERE id = $1',
      [event.id]
    );
  }

  private async getMatchingSubscriptions(tenantId: string, event: InventoryEvent): Promise<ChannelSubscription[]> {
    const result = await pool.query(
      `SELECT cs.* FROM cb4_channel_subscriptions cs
       JOIN cb4_channels c ON cs.channel_id = c.id
       WHERE cs.tenant_id = $1 
       AND cs.status = 'active'
       AND c.is_active = true
       AND cs.event_types @> $2
       AND (cs.product_id IS NULL OR cs.product_id = $3)
       AND (cs.location_id IS NULL OR cs.location_id = $4)`,
      [tenantId, JSON.stringify([event.eventType]), event.productId, event.locationId]
    );

    return result.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      channelId: row.channel_id,
      productId: row.product_id,
      locationId: row.location_id,
      eventTypes: row.event_types,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  private async getChannelById(tenantId: string, channelId: string): Promise<{ id: string; webhookUrl?: string; apiKey?: string } | null> {
    const result = await pool.query(
      'SELECT id, webhook_url, api_key FROM cb4_channels WHERE id = $1 AND tenant_id = $2',
      [channelId, tenantId]
    );
    if (result.rows.length === 0) return null;
    return {
      id: result.rows[0].id,
      webhookUrl: result.rows[0].webhook_url,
      apiKey: result.rows[0].api_key,
    };
  }

  private generateSignature(event: InventoryEvent, apiKey?: string): string {
    if (!apiKey) return '';
    const crypto = require('crypto');
    return crypto.createHmac('sha256', apiKey)
      .update(JSON.stringify(event.payload))
      .digest('hex');
  }

  private mapRow(row: Record<string, unknown>): InventoryEvent {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      eventType: row.event_type as EventType,
      productId: row.product_id as string | undefined,
      locationId: row.location_id as string | undefined,
      channelId: row.channel_id as string | undefined,
      payload: row.payload as Record<string, unknown>,
      processedAt: row.processed_at ? new Date(row.processed_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}
