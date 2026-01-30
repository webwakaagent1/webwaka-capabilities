import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { ReportDefinition, ReportConfig, ReportExecution, QueryOptions } from '../models/types';
import { queryService } from './QueryService';
import { v4 as uuidv4 } from 'uuid';

export class ReportService {
  private systemReports: ReportDefinition[] = [];

  constructor() {
    this.initializeSystemReports();
  }

  private initializeSystemReports() {
    const now = new Date();
    this.systemReports = [
      {
        id: 'system-sales-summary',
        tenantId: 'system',
        name: 'Sales Summary',
        slug: 'sales-summary',
        description: 'Overview of sales performance including revenue, orders, and average order value',
        reportType: 'standard',
        config: {
          metrics: ['revenue', 'order_count', 'order_value'],
          groupBy: ['dimensions.channel'],
          dateRange: { preset: 'last_30_days' },
          visualization: 'bar_chart',
        },
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'system-inventory-status',
        tenantId: 'system',
        name: 'Inventory Status',
        slug: 'inventory-status',
        description: 'Current inventory levels and stock movement',
        reportType: 'standard',
        config: {
          metrics: ['stock_level', 'stock_in', 'stock_out'],
          groupBy: ['dimensions.product_category'],
          visualization: 'table',
        },
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'system-user-activity',
        tenantId: 'system',
        name: 'User Activity',
        slug: 'user-activity',
        description: 'User engagement and activity metrics',
        reportType: 'standard',
        config: {
          metrics: ['active_users', 'page_views', 'session_duration'],
          dateRange: { preset: 'last_7_days' },
          visualization: 'line_chart',
        },
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'system-financial-overview',
        tenantId: 'system',
        name: 'Financial Overview',
        slug: 'financial-overview',
        description: 'Revenue, costs, and profit margins',
        reportType: 'standard',
        config: {
          metrics: ['revenue', 'costs', 'profit', 'margin'],
          groupBy: ['dimensions.business_unit'],
          dateRange: { preset: 'this_month' },
          visualization: 'kpi_card',
        },
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'system-top-products',
        tenantId: 'system',
        name: 'Top Products',
        slug: 'top-products',
        description: 'Best selling products by revenue and quantity',
        reportType: 'standard',
        config: {
          metrics: ['revenue', 'quantity_sold'],
          groupBy: ['dimensions.product_name'],
          orderBy: [{ field: 'revenue_sum', direction: 'desc' }],
          limit: 10,
          visualization: 'bar_chart',
        },
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'system-customer-segments',
        tenantId: 'system',
        name: 'Customer Segments',
        slug: 'customer-segments',
        description: 'Customer distribution by segment and lifetime value',
        reportType: 'standard',
        config: {
          metrics: ['customer_count', 'lifetime_value', 'average_order_value'],
          groupBy: ['dimensions.customer_segment'],
          visualization: 'pie_chart',
        },
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'system-revenue-trends',
        tenantId: 'system',
        name: 'Revenue Trends',
        slug: 'revenue-trends',
        description: 'Revenue over time with trend analysis',
        reportType: 'standard',
        config: {
          metrics: ['revenue'],
          dateRange: { preset: 'last_30_days' },
          visualization: 'line_chart',
        },
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'system-conversion-funnel',
        tenantId: 'system',
        name: 'Conversion Funnel',
        slug: 'conversion-funnel',
        description: 'Conversion rates through the sales funnel',
        reportType: 'standard',
        config: {
          metrics: ['visitors', 'leads', 'opportunities', 'customers'],
          visualization: 'bar_chart',
        },
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'system-geographic-distribution',
        tenantId: 'system',
        name: 'Geographic Distribution',
        slug: 'geographic-distribution',
        description: 'Sales and customer distribution by region',
        reportType: 'standard',
        config: {
          metrics: ['revenue', 'customer_count', 'order_count'],
          groupBy: ['dimensions.region', 'dimensions.country'],
          visualization: 'table',
        },
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'system-performance-metrics',
        tenantId: 'system',
        name: 'Performance Metrics',
        slug: 'performance-metrics',
        description: 'Key performance indicators and metrics',
        reportType: 'standard',
        config: {
          metrics: ['response_time', 'error_rate', 'uptime', 'throughput'],
          dateRange: { preset: 'last_7_days' },
          visualization: 'kpi_card',
        },
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  async createReport(input: {
    tenantId: string;
    name: string;
    slug: string;
    description?: string;
    config: ReportConfig;
    createdBy?: string;
  }): Promise<ReportDefinition> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      const result = await client.query(
        `INSERT INTO cb2_report_definitions (id, tenant_id, name, slug, description, report_type, config, is_system, created_by)
         VALUES ($1, $2, $3, $4, $5, 'custom', $6, false, $7)
         RETURNING *`,
        [id, input.tenantId, input.name, input.slug, input.description, JSON.stringify(input.config), input.createdBy]
      );

      logger.info('Report created', { id, slug: input.slug, tenantId: input.tenantId });
      return this.mapRowToReport(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getReport(id: string, tenantId: string): Promise<ReportDefinition | null> {
    const systemReport = this.systemReports.find(r => r.id === id || r.slug === id);
    if (systemReport) {
      return { ...systemReport, tenantId };
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM cb2_report_definitions WHERE (id = $1 OR slug = $1) AND tenant_id = $2',
        [id, tenantId]
      );
      return result.rows[0] ? this.mapRowToReport(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async listReports(tenantId: string, options?: { includeSystem?: boolean }): Promise<ReportDefinition[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM cb2_report_definitions WHERE tenant_id = $1 ORDER BY name',
        [tenantId]
      );

      const tenantReports = result.rows.map(row => this.mapRowToReport(row));
      
      if (options?.includeSystem !== false) {
        const systemReportsWithTenant = this.systemReports.map(r => ({ ...r, tenantId }));
        return [...systemReportsWithTenant, ...tenantReports];
      }

      return tenantReports;
    } finally {
      client.release();
    }
  }

  async updateReport(id: string, tenantId: string, updates: Partial<{
    name: string;
    description: string;
    config: ReportConfig;
  }>): Promise<ReportDefinition | null> {
    const client = await pool.connect();
    try {
      const existing = await this.getReport(id, tenantId);
      if (!existing) return null;
      if (existing.isSystem) {
        throw new Error('Cannot modify system reports');
      }

      const setClauses: string[] = [];
      const params: unknown[] = [id, tenantId];
      let paramIndex = 3;

      if (updates.name) {
        setClauses.push(`name = $${paramIndex++}`);
        params.push(updates.name);
      }
      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        params.push(updates.description);
      }
      if (updates.config) {
        setClauses.push(`config = $${paramIndex++}`);
        params.push(JSON.stringify(updates.config));
      }

      setClauses.push('updated_at = NOW()');

      const result = await client.query(
        `UPDATE cb2_report_definitions SET ${setClauses.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        params
      );

      return result.rows[0] ? this.mapRowToReport(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async deleteReport(id: string, tenantId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const existing = await this.getReport(id, tenantId);
      if (!existing) return false;
      if (existing.isSystem) {
        throw new Error('Cannot delete system reports');
      }

      const result = await client.query(
        'DELETE FROM cb2_report_definitions WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );

      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  async executeReport(reportId: string, tenantId: string, parameters?: {
    dateRange?: { start: Date; end: Date };
    filters?: Record<string, unknown>;
    executedBy?: string;
  }): Promise<ReportExecution> {
    const client = await pool.connect();
    try {
      const report = await this.getReport(reportId, tenantId);
      if (!report) {
        throw new Error('Report not found');
      }

      const executionId = uuidv4();
      await client.query(
        `INSERT INTO cb2_report_executions (id, tenant_id, report_definition_id, executed_by, parameters, status)
         VALUES ($1, $2, $3, $4, $5, 'running')`,
        [executionId, tenantId, report.id, parameters?.executedBy, JSON.stringify(parameters || {})]
      );

      try {
        const queryOptions: QueryOptions = {
          metrics: report.config.metrics,
          dimensions: report.config.dimensions,
          filters: report.config.filters,
          groupBy: report.config.groupBy,
          orderBy: report.config.orderBy,
          limit: report.config.limit,
          dateRange: parameters?.dateRange ? { start: parameters.dateRange.start, end: parameters.dateRange.end } : report.config.dateRange,
        };

        const result = await queryService.executeQuery(tenantId, queryOptions);

        await client.query(
          `UPDATE cb2_report_executions 
           SET status = 'completed', result_data = $1, completed_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(result), executionId]
        );

        const executionResult = await client.query(
          'SELECT * FROM cb2_report_executions WHERE id = $1',
          [executionId]
        );

        logger.info('Report executed', { reportId, executionId, tenantId });
        return this.mapRowToExecution(executionResult.rows[0]);
      } catch (error) {
        await client.query(
          `UPDATE cb2_report_executions 
           SET status = 'failed', error_message = $1, completed_at = NOW()
           WHERE id = $2`,
          [(error as Error).message, executionId]
        );
        throw error;
      }
    } finally {
      client.release();
    }
  }

  async getExecution(executionId: string, tenantId: string): Promise<ReportExecution | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM cb2_report_executions WHERE id = $1 AND tenant_id = $2',
        [executionId, tenantId]
      );
      return result.rows[0] ? this.mapRowToExecution(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  private mapRowToReport(row: Record<string, unknown>): ReportDefinition {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      slug: row.slug as string,
      description: row.description as string | undefined,
      reportType: row.report_type as 'standard' | 'custom' | 'scheduled',
      config: row.config as ReportConfig,
      isSystem: row.is_system as boolean,
      createdBy: row.created_by as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapRowToExecution(row: Record<string, unknown>): ReportExecution {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      reportDefinitionId: row.report_definition_id as string,
      executedBy: row.executed_by as string | undefined,
      parameters: row.parameters as Record<string, unknown>,
      status: row.status as 'pending' | 'running' | 'completed' | 'failed',
      resultData: row.result_data as Record<string, unknown> | undefined,
      exportUrl: row.export_url as string | undefined,
      startedAt: new Date(row.started_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      errorMessage: row.error_message as string | undefined,
    };
  }
}

export const reportService = new ReportService();
