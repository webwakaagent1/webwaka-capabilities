import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { Metric, MetricType } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

export class MetricsService {
  async recordMetric(input: {
    tenantId: string;
    metricType: MetricType;
    metricName: string;
    value: number;
    dimensions?: Record<string, string>;
    timestamp?: Date;
    source?: string;
  }): Promise<Metric> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      const timestamp = input.timestamp || new Date();
      const dimensions = input.dimensions || {};

      const result = await client.query(
        `INSERT INTO cb2_metrics (id, tenant_id, metric_type, metric_name, value, dimensions, timestamp, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [id, input.tenantId, input.metricType, input.metricName, input.value, JSON.stringify(dimensions), timestamp, input.source]
      );

      const row = result.rows[0];
      logger.info('Metric recorded', { id, metricName: input.metricName, tenantId: input.tenantId });

      return this.mapRowToMetric(row);
    } finally {
      client.release();
    }
  }

  async recordBatch(tenantId: string, metrics: Array<{
    metricType: MetricType;
    metricName: string;
    value: number;
    dimensions?: Record<string, string>;
    timestamp?: Date;
    source?: string;
  }>): Promise<number> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let count = 0;
      for (const metric of metrics) {
        const id = uuidv4();
        const timestamp = metric.timestamp || new Date();
        const dimensions = metric.dimensions || {};

        await client.query(
          `INSERT INTO cb2_metrics (id, tenant_id, metric_type, metric_name, value, dimensions, timestamp, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, tenantId, metric.metricType, metric.metricName, metric.value, JSON.stringify(dimensions), timestamp, metric.source]
        );
        count++;
      }

      await client.query('COMMIT');
      logger.info('Batch metrics recorded', { count, tenantId });
      return count;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getMetrics(tenantId: string, options: {
    metricName?: string;
    metricType?: MetricType;
    startDate?: Date;
    endDate?: Date;
    dimensions?: Record<string, string>;
    limit?: number;
    offset?: number;
  }): Promise<{ metrics: Metric[]; total: number }> {
    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM cb2_metrics WHERE tenant_id = $1';
      const params: unknown[] = [tenantId];
      let paramIndex = 2;

      if (options.metricName) {
        query += ` AND metric_name = $${paramIndex++}`;
        params.push(options.metricName);
      }

      if (options.metricType) {
        query += ` AND metric_type = $${paramIndex++}`;
        params.push(options.metricType);
      }

      if (options.startDate) {
        query += ` AND timestamp >= $${paramIndex++}`;
        params.push(options.startDate);
      }

      if (options.endDate) {
        query += ` AND timestamp <= $${paramIndex++}`;
        params.push(options.endDate);
      }

      if (options.dimensions) {
        query += ` AND dimensions @> $${paramIndex++}`;
        params.push(JSON.stringify(options.dimensions));
      }

      const countResult = await client.query(
        query.replace('SELECT *', 'SELECT COUNT(*)'),
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      query += ' ORDER BY timestamp DESC';

      if (options.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(options.limit);
      }

      if (options.offset) {
        query += ` OFFSET $${paramIndex++}`;
        params.push(options.offset);
      }

      const result = await client.query(query, params);
      const metrics = result.rows.map(row => this.mapRowToMetric(row));

      return { metrics, total };
    } finally {
      client.release();
    }
  }

  async getMetricNames(tenantId: string): Promise<string[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT DISTINCT metric_name FROM cb2_metrics WHERE tenant_id = $1 ORDER BY metric_name',
        [tenantId]
      );
      return result.rows.map(row => row.metric_name);
    } finally {
      client.release();
    }
  }

  private mapRowToMetric(row: Record<string, unknown>): Metric {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      metricType: row.metric_type as MetricType,
      metricName: row.metric_name as string,
      value: parseFloat(row.value as string),
      dimensions: row.dimensions as Record<string, string>,
      timestamp: new Date(row.timestamp as string),
      source: row.source as string | undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}

export const metricsService = new MetricsService();
