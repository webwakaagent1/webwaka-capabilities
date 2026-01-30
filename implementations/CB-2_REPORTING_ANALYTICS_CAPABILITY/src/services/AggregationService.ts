import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { Aggregation, Granularity } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

export class AggregationService {
  async aggregateMetrics(tenantId: string, options: {
    metricName: string;
    granularity: Granularity;
    startDate: Date;
    endDate: Date;
    dimensions?: Record<string, string>;
  }): Promise<Aggregation[]> {
    const client = await pool.connect();
    try {
      const intervalMap: Record<Granularity, string> = {
        minute: '1 minute',
        hour: '1 hour',
        day: '1 day',
        week: '1 week',
        month: '1 month',
        year: '1 year',
      };

      let query = `
        SELECT 
          date_trunc($1, timestamp) as period_start,
          date_trunc($1, timestamp) + interval '${intervalMap[options.granularity]}' as period_end,
          SUM(value) as sum_value,
          COUNT(*) as count_value,
          MIN(value) as min_value,
          MAX(value) as max_value,
          AVG(value) as avg_value
        FROM cb2_metrics
        WHERE tenant_id = $2
          AND metric_name = $3
          AND timestamp >= $4
          AND timestamp <= $5
      `;

      const params: unknown[] = [
        options.granularity,
        tenantId,
        options.metricName,
        options.startDate,
        options.endDate,
      ];

      let paramIndex = 6;
      if (options.dimensions && Object.keys(options.dimensions).length > 0) {
        query += ` AND dimensions @> $${paramIndex++}`;
        params.push(JSON.stringify(options.dimensions));
      }

      query += ` GROUP BY date_trunc($1, timestamp) ORDER BY period_start`;

      const result = await client.query(query, params);

      const aggregations: Aggregation[] = result.rows.map(row => ({
        id: uuidv4(),
        tenantId,
        aggregationType: 'sum' as const,
        metricName: options.metricName,
        periodStart: new Date(row.period_start),
        periodEnd: new Date(row.period_end),
        granularity: options.granularity,
        dimensions: options.dimensions || {},
        sumValue: parseFloat(row.sum_value) || 0,
        countValue: parseInt(row.count_value, 10) || 0,
        minValue: row.min_value ? parseFloat(row.min_value) : null,
        maxValue: row.max_value ? parseFloat(row.max_value) : null,
        avgValue: row.avg_value ? parseFloat(row.avg_value) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      logger.info('Aggregation computed', {
        tenantId,
        metricName: options.metricName,
        granularity: options.granularity,
        resultCount: aggregations.length,
      });

      return aggregations;
    } finally {
      client.release();
    }
  }

  async storeAggregation(aggregation: Aggregation): Promise<Aggregation> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO cb2_aggregations 
         (id, tenant_id, aggregation_type, metric_name, period_start, period_end, granularity, dimensions, sum_value, count_value, min_value, max_value, avg_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (tenant_id, metric_name, period_start, granularity, dimensions) 
         DO UPDATE SET sum_value = $9, count_value = $10, min_value = $11, max_value = $12, avg_value = $13, updated_at = NOW()
         RETURNING *`,
        [
          aggregation.id,
          aggregation.tenantId,
          aggregation.aggregationType,
          aggregation.metricName,
          aggregation.periodStart,
          aggregation.periodEnd,
          aggregation.granularity,
          JSON.stringify(aggregation.dimensions),
          aggregation.sumValue,
          aggregation.countValue,
          aggregation.minValue,
          aggregation.maxValue,
          aggregation.avgValue,
        ]
      );

      return this.mapRowToAggregation(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getStoredAggregations(tenantId: string, options: {
    metricName: string;
    granularity: Granularity;
    startDate: Date;
    endDate: Date;
  }): Promise<Aggregation[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM cb2_aggregations 
         WHERE tenant_id = $1 
           AND metric_name = $2 
           AND granularity = $3 
           AND period_start >= $4 
           AND period_end <= $5
         ORDER BY period_start`,
        [tenantId, options.metricName, options.granularity, options.startDate, options.endDate]
      );

      return result.rows.map(row => this.mapRowToAggregation(row));
    } finally {
      client.release();
    }
  }

  async runBatchAggregation(tenantId: string, options: {
    granularity: Granularity;
    startDate: Date;
    endDate: Date;
  }): Promise<number> {
    const client = await pool.connect();
    try {
      const metricsResult = await client.query(
        'SELECT DISTINCT metric_name FROM cb2_metrics WHERE tenant_id = $1',
        [tenantId]
      );

      let count = 0;
      for (const row of metricsResult.rows) {
        const aggregations = await this.aggregateMetrics(tenantId, {
          metricName: row.metric_name,
          granularity: options.granularity,
          startDate: options.startDate,
          endDate: options.endDate,
        });

        for (const agg of aggregations) {
          await this.storeAggregation(agg);
          count++;
        }
      }

      logger.info('Batch aggregation completed', { tenantId, count, granularity: options.granularity });
      return count;
    } finally {
      client.release();
    }
  }

  private mapRowToAggregation(row: Record<string, unknown>): Aggregation {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      aggregationType: row.aggregation_type as 'sum',
      metricName: row.metric_name as string,
      periodStart: new Date(row.period_start as string),
      periodEnd: new Date(row.period_end as string),
      granularity: row.granularity as Granularity,
      dimensions: row.dimensions as Record<string, string>,
      sumValue: parseFloat(row.sum_value as string) || 0,
      countValue: parseInt(row.count_value as string, 10) || 0,
      minValue: row.min_value ? parseFloat(row.min_value as string) : null,
      maxValue: row.max_value ? parseFloat(row.max_value as string) : null,
      avgValue: row.avg_value ? parseFloat(row.avg_value as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export const aggregationService = new AggregationService();
