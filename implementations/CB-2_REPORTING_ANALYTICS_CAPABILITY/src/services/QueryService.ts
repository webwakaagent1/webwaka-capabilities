import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { QueryOptions, QueryResult, QueryFilter, OrderBy, DateRange, Granularity } from '../models/types';

export class QueryService {
  async executeQuery(tenantId: string, options: QueryOptions): Promise<QueryResult> {
    const startTime = Date.now();
    const client = await pool.connect();

    try {
      const { sql, params } = this.buildQuery(tenantId, options);

      const countSql = sql.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as total FROM').split('ORDER BY')[0].split('LIMIT')[0];
      const countResult = await client.query(countSql, params);
      const totalCount = parseInt(countResult.rows[0]?.total || '0', 10);

      const result = await client.query(sql, params);
      const executionTime = Date.now() - startTime;

      logger.info('Query executed', {
        tenantId,
        metrics: options.metrics,
        executionTime,
        resultCount: result.rows.length,
      });

      return {
        data: result.rows,
        metadata: {
          totalCount,
          limit: options.limit || 100,
          offset: options.offset || 0,
          executionTime,
        },
      };
    } finally {
      client.release();
    }
  }

  private buildQuery(tenantId: string, options: QueryOptions): { sql: string; params: unknown[] } {
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    const selectFields: string[] = [];
    
    if (options.granularity) {
      selectFields.push(`date_trunc('${options.granularity}', timestamp) as period`);
    }

    if (options.groupBy && options.groupBy.length > 0) {
      for (const field of options.groupBy) {
        if (field.startsWith('dimensions.')) {
          const dimKey = field.replace('dimensions.', '');
          selectFields.push(`dimensions->>'${dimKey}' as "${field}"`);
        } else {
          selectFields.push(field);
        }
      }
    }

    for (const metric of options.metrics) {
      selectFields.push(`SUM(CASE WHEN metric_name = '${metric}' THEN value ELSE 0 END) as "${metric}_sum"`);
      selectFields.push(`COUNT(CASE WHEN metric_name = '${metric}' THEN 1 END) as "${metric}_count"`);
      selectFields.push(`AVG(CASE WHEN metric_name = '${metric}' THEN value END) as "${metric}_avg"`);
    }

    if (selectFields.length === 0) {
      selectFields.push('*');
    }

    let sql = `SELECT ${selectFields.join(', ')} FROM cb2_metrics WHERE tenant_id = $1`;

    if (options.metrics.length > 0) {
      sql += ` AND metric_name = ANY($${paramIndex++})`;
      params.push(options.metrics);
    }

    if (options.filters) {
      for (const filter of options.filters) {
        const { clause, value } = this.buildFilterClause(filter, paramIndex);
        sql += ` AND ${clause}`;
        params.push(value);
        paramIndex++;
      }
    }

    if (options.dateRange) {
      const { start, end } = this.resolveDateRange(options.dateRange);
      sql += ` AND timestamp >= $${paramIndex++}`;
      params.push(start);
      sql += ` AND timestamp <= $${paramIndex++}`;
      params.push(end);
    }

    const groupByFields: string[] = [];
    if (options.granularity) {
      groupByFields.push(`date_trunc('${options.granularity}', timestamp)`);
    }
    if (options.groupBy) {
      for (const field of options.groupBy) {
        if (field.startsWith('dimensions.')) {
          const dimKey = field.replace('dimensions.', '');
          groupByFields.push(`dimensions->>'${dimKey}'`);
        } else {
          groupByFields.push(field);
        }
      }
    }
    if (groupByFields.length > 0) {
      sql += ` GROUP BY ${groupByFields.join(', ')}`;
    }

    if (options.orderBy && options.orderBy.length > 0) {
      const orderClauses = options.orderBy.map(o => `"${o.field}" ${o.direction.toUpperCase()}`);
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    } else if (options.granularity) {
      sql += ` ORDER BY period`;
    }

    const limit = options.limit || 100;
    const offset = options.offset || 0;
    sql += ` LIMIT $${paramIndex++}`;
    params.push(limit);
    sql += ` OFFSET $${paramIndex++}`;
    params.push(offset);

    return { sql, params };
  }

  private buildFilterClause(filter: QueryFilter, paramIndex: number): { clause: string; value: unknown } {
    const field = filter.field.startsWith('dimensions.')
      ? `dimensions->>'${filter.field.replace('dimensions.', '')}'`
      : filter.field;

    switch (filter.operator) {
      case 'eq':
        return { clause: `${field} = $${paramIndex}`, value: filter.value };
      case 'neq':
        return { clause: `${field} != $${paramIndex}`, value: filter.value };
      case 'gt':
        return { clause: `${field} > $${paramIndex}`, value: filter.value };
      case 'gte':
        return { clause: `${field} >= $${paramIndex}`, value: filter.value };
      case 'lt':
        return { clause: `${field} < $${paramIndex}`, value: filter.value };
      case 'lte':
        return { clause: `${field} <= $${paramIndex}`, value: filter.value };
      case 'in':
        return { clause: `${field} = ANY($${paramIndex})`, value: filter.value };
      case 'like':
        return { clause: `${field} ILIKE $${paramIndex}`, value: `%${filter.value}%` };
      default:
        return { clause: `${field} = $${paramIndex}`, value: filter.value };
    }
  }

  private resolveDateRange(dateRange: DateRange): { start: Date; end: Date } {
    if (dateRange.preset) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (dateRange.preset) {
        case 'today':
          return { start: startOfDay, end: now };
        case 'yesterday':
          const yesterday = new Date(startOfDay);
          yesterday.setDate(yesterday.getDate() - 1);
          return { start: yesterday, end: startOfDay };
        case 'last_7_days':
          const last7 = new Date(startOfDay);
          last7.setDate(last7.getDate() - 7);
          return { start: last7, end: now };
        case 'last_30_days':
          const last30 = new Date(startOfDay);
          last30.setDate(last30.getDate() - 30);
          return { start: last30, end: now };
        case 'this_month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          return { start: monthStart, end: now };
        case 'last_month':
          const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
          return { start: lastMonthStart, end: lastMonthEnd };
        case 'this_year':
          const yearStart = new Date(now.getFullYear(), 0, 1);
          return { start: yearStart, end: now };
        default:
          return { start: startOfDay, end: now };
      }
    }

    return {
      start: dateRange.start ? new Date(dateRange.start) : new Date(),
      end: dateRange.end ? new Date(dateRange.end) : new Date(),
    };
  }

  async getAvailableDimensions(tenantId: string, metricName?: string): Promise<string[]> {
    const client = await pool.connect();
    try {
      let query = `
        SELECT DISTINCT jsonb_object_keys(dimensions) as dimension_key
        FROM cb2_metrics
        WHERE tenant_id = $1
      `;
      const params: unknown[] = [tenantId];

      if (metricName) {
        query += ' AND metric_name = $2';
        params.push(metricName);
      }

      const result = await client.query(query, params);
      return result.rows.map(row => row.dimension_key);
    } finally {
      client.release();
    }
  }
}

export const queryService = new QueryService();
