import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { Dashboard, Widget, WidgetLayout, WidgetType, WidgetConfig, DataSource } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

export class DashboardService {
  private systemWidgets: Widget[] = [];

  constructor() {
    this.initializeSystemWidgets();
  }

  private initializeSystemWidgets() {
    const now = new Date();
    this.systemWidgets = [
      {
        id: 'widget-line-chart',
        tenantId: 'system',
        name: 'Line Chart',
        widgetType: 'line_chart',
        config: {
          title: 'Trend Over Time',
          showLegend: true,
          showLabels: true,
          colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'],
        },
        dataSource: { type: 'query', query: { metrics: [] } },
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'widget-bar-chart',
        tenantId: 'system',
        name: 'Bar Chart',
        widgetType: 'bar_chart',
        config: {
          title: 'Comparison',
          showLegend: true,
          showLabels: true,
          colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'],
        },
        dataSource: { type: 'query', query: { metrics: [] } },
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'widget-pie-chart',
        tenantId: 'system',
        name: 'Pie Chart',
        widgetType: 'pie_chart',
        config: {
          title: 'Distribution',
          showLegend: true,
          showLabels: true,
          colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
        },
        dataSource: { type: 'query', query: { metrics: [] } },
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'widget-table',
        tenantId: 'system',
        name: 'Data Table',
        widgetType: 'table',
        config: {
          title: 'Data Table',
          columns: [],
        },
        dataSource: { type: 'query', query: { metrics: [] } },
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'widget-kpi-card',
        tenantId: 'system',
        name: 'KPI Card',
        widgetType: 'kpi_card',
        config: {
          title: 'Key Metric',
          format: 'number',
          thresholds: [
            { value: 0, color: '#EF4444', label: 'Low' },
            { value: 50, color: '#F59E0B', label: 'Medium' },
            { value: 80, color: '#10B981', label: 'Good' },
          ],
        },
        dataSource: { type: 'query', query: { metrics: [] } },
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  async createDashboard(input: {
    tenantId: string;
    name: string;
    slug: string;
    description?: string;
    layout?: WidgetLayout[];
    widgets?: Widget[];
    isDefault?: boolean;
    createdBy?: string;
  }): Promise<Dashboard> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      const result = await client.query(
        `INSERT INTO cb2_dashboards (id, tenant_id, name, slug, description, layout, widgets, is_default, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          id,
          input.tenantId,
          input.name,
          input.slug,
          input.description,
          JSON.stringify(input.layout || []),
          JSON.stringify(input.widgets || []),
          input.isDefault || false,
          input.createdBy,
        ]
      );

      logger.info('Dashboard created', { id, slug: input.slug, tenantId: input.tenantId });
      return this.mapRowToDashboard(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getDashboard(id: string, tenantId: string): Promise<Dashboard | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM cb2_dashboards WHERE (id = $1 OR slug = $1) AND tenant_id = $2',
        [id, tenantId]
      );
      return result.rows[0] ? this.mapRowToDashboard(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async listDashboards(tenantId: string): Promise<Dashboard[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM cb2_dashboards WHERE tenant_id = $1 ORDER BY is_default DESC, name',
        [tenantId]
      );
      return result.rows.map(row => this.mapRowToDashboard(row));
    } finally {
      client.release();
    }
  }

  async getDefaultDashboard(tenantId: string): Promise<Dashboard | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM cb2_dashboards WHERE tenant_id = $1 AND is_default = true LIMIT 1',
        [tenantId]
      );
      return result.rows[0] ? this.mapRowToDashboard(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async updateDashboard(id: string, tenantId: string, updates: Partial<{
    name: string;
    description: string;
    layout: WidgetLayout[];
    widgets: Widget[];
    isDefault: boolean;
  }>): Promise<Dashboard | null> {
    const client = await pool.connect();
    try {
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
      if (updates.layout) {
        setClauses.push(`layout = $${paramIndex++}`);
        params.push(JSON.stringify(updates.layout));
      }
      if (updates.widgets) {
        setClauses.push(`widgets = $${paramIndex++}`);
        params.push(JSON.stringify(updates.widgets));
      }
      if (updates.isDefault !== undefined) {
        if (updates.isDefault) {
          await client.query(
            'UPDATE cb2_dashboards SET is_default = false WHERE tenant_id = $1',
            [tenantId]
          );
        }
        setClauses.push(`is_default = $${paramIndex++}`);
        params.push(updates.isDefault);
      }

      if (setClauses.length === 0) return this.getDashboard(id, tenantId);

      setClauses.push('updated_at = NOW()');

      const result = await client.query(
        `UPDATE cb2_dashboards SET ${setClauses.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        params
      );

      return result.rows[0] ? this.mapRowToDashboard(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async deleteDashboard(id: string, tenantId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM cb2_dashboards WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  async addWidget(dashboardId: string, tenantId: string, widget: {
    name: string;
    widgetType: WidgetType;
    config: WidgetConfig;
    dataSource: DataSource;
    layout?: { x: number; y: number; width: number; height: number };
  }): Promise<Dashboard | null> {
    const client = await pool.connect();
    try {
      const dashboard = await this.getDashboard(dashboardId, tenantId);
      if (!dashboard) return null;

      const widgetId = uuidv4();
      const newWidget: Widget = {
        id: widgetId,
        tenantId,
        name: widget.name,
        widgetType: widget.widgetType,
        config: widget.config,
        dataSource: widget.dataSource,
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const widgets = [...dashboard.widgets, newWidget];
      const layout = [...dashboard.layout];
      
      if (widget.layout) {
        layout.push({
          widgetId,
          ...widget.layout,
        });
      } else {
        layout.push({
          widgetId,
          x: 0,
          y: layout.length > 0 ? Math.max(...layout.map(l => l.y + l.height)) : 0,
          width: 6,
          height: 4,
        });
      }

      return this.updateDashboard(dashboardId, tenantId, { widgets, layout });
    } finally {
      client.release();
    }
  }

  async removeWidget(dashboardId: string, tenantId: string, widgetId: string): Promise<Dashboard | null> {
    const dashboard = await this.getDashboard(dashboardId, tenantId);
    if (!dashboard) return null;

    const widgets = dashboard.widgets.filter(w => w.id !== widgetId);
    const layout = dashboard.layout.filter(l => l.widgetId !== widgetId);

    return this.updateDashboard(dashboardId, tenantId, { widgets, layout });
  }

  getSystemWidgets(): Widget[] {
    return this.systemWidgets;
  }

  getSystemWidget(widgetType: WidgetType): Widget | undefined {
    return this.systemWidgets.find(w => w.widgetType === widgetType);
  }

  private mapRowToDashboard(row: Record<string, unknown>): Dashboard {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      slug: row.slug as string,
      description: row.description as string | undefined,
      layout: row.layout as WidgetLayout[],
      widgets: row.widgets as Widget[],
      isDefault: row.is_default as boolean,
      createdBy: row.created_by as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export const dashboardService = new DashboardService();
