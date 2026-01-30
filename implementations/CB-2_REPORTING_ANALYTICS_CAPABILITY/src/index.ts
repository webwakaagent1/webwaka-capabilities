import express from 'express';
import { initializeDatabase, runMigrations, pool } from './config/database';
import { logger } from './utils/logger';
import { metricsService } from './services/MetricsService';
import { aggregationService } from './services/AggregationService';
import { queryService } from './services/QueryService';
import { reportService } from './services/ReportService';
import { dashboardService } from './services/DashboardService';
import { exportService } from './services/ExportService';
import { QueryOptions, ExportFormat } from './models/types';

export const app = express();
const PORT = parseInt(process.env.CB2_PORT || '5000', 10);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    service: 'WebWaka CB-2 Reporting & Analytics Capability',
    version: '1.0.0',
    endpoints: {
      metrics: '/api/v1/metrics',
      aggregations: '/api/v1/aggregations',
      query: '/api/v1/query',
      reports: '/api/v1/reports',
      dashboards: '/api/v1/dashboards',
      export: '/api/v1/export',
    },
  });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

app.post('/api/v1/metrics', async (req, res) => {
  try {
    const { tenantId, metricType, metricName, value, dimensions, timestamp, source } = req.body;
    if (!tenantId || !metricType || !metricName || value === undefined) {
      return res.status(400).json({ error: 'tenantId, metricType, metricName, and value are required' });
    }
    const metric = await metricsService.recordMetric({
      tenantId, metricType, metricName, value, dimensions, timestamp: timestamp ? new Date(timestamp) : undefined, source,
    });
    res.status(201).json({ data: metric });
  } catch (error) {
    logger.error('Error recording metric', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/v1/metrics/batch', async (req, res) => {
  try {
    const { tenantId, metrics } = req.body;
    if (!tenantId || !metrics || !Array.isArray(metrics)) {
      return res.status(400).json({ error: 'tenantId and metrics array are required' });
    }
    const count = await metricsService.recordBatch(tenantId, metrics);
    res.status(201).json({ data: { recorded: count } });
  } catch (error) {
    logger.error('Error recording batch metrics', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/v1/metrics', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });

    const result = await metricsService.getMetrics(tenantId, {
      metricName: req.query.metricName as string,
      metricType: req.query.metricType as any,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    });
    res.json({ data: result.metrics, total: result.total });
  } catch (error) {
    logger.error('Error fetching metrics', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/v1/metrics/names', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const names = await metricsService.getMetricNames(tenantId);
    res.json({ data: names });
  } catch (error) {
    logger.error('Error fetching metric names', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/v1/aggregations', async (req, res) => {
  try {
    const { tenantId, metricName, granularity, startDate, endDate, dimensions } = req.body;
    if (!tenantId || !metricName || !granularity || !startDate || !endDate) {
      return res.status(400).json({ error: 'tenantId, metricName, granularity, startDate, and endDate are required' });
    }
    const aggregations = await aggregationService.aggregateMetrics(tenantId, {
      metricName, granularity, startDate: new Date(startDate), endDate: new Date(endDate), dimensions,
    });
    res.json({ data: aggregations });
  } catch (error) {
    logger.error('Error computing aggregations', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/v1/aggregations/batch', async (req, res) => {
  try {
    const { tenantId, granularity, startDate, endDate } = req.body;
    if (!tenantId || !granularity || !startDate || !endDate) {
      return res.status(400).json({ error: 'tenantId, granularity, startDate, and endDate are required' });
    }
    const count = await aggregationService.runBatchAggregation(tenantId, {
      granularity, startDate: new Date(startDate), endDate: new Date(endDate),
    });
    res.json({ data: { aggregated: count } });
  } catch (error) {
    logger.error('Error running batch aggregation', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/v1/query', async (req, res) => {
  try {
    const { tenantId, ...queryOptions } = req.body;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    if (!queryOptions.metrics || !Array.isArray(queryOptions.metrics)) {
      return res.status(400).json({ error: 'metrics array is required' });
    }
    const result = await queryService.executeQuery(tenantId, queryOptions as QueryOptions);
    res.json(result);
  } catch (error) {
    logger.error('Error executing query', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/v1/query/dimensions', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const dimensions = await queryService.getAvailableDimensions(tenantId, req.query.metricName as string);
    res.json({ data: dimensions });
  } catch (error) {
    logger.error('Error fetching dimensions', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/v1/reports', async (req, res) => {
  try {
    const { tenantId, name, slug, description, config, createdBy } = req.body;
    if (!tenantId || !name || !slug || !config) {
      return res.status(400).json({ error: 'tenantId, name, slug, and config are required' });
    }
    const report = await reportService.createReport({ tenantId, name, slug, description, config, createdBy });
    res.status(201).json({ data: report });
  } catch (error) {
    logger.error('Error creating report', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/v1/reports', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const includeSystem = req.query.includeSystem !== 'false';
    const reports = await reportService.listReports(tenantId, { includeSystem });
    res.json({ data: reports });
  } catch (error) {
    logger.error('Error listing reports', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/v1/reports/:id', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const report = await reportService.getReport(req.params.id, tenantId);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ data: report });
  } catch (error) {
    logger.error('Error fetching report', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.patch('/api/v1/reports/:id', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const report = await reportService.updateReport(req.params.id, tenantId, req.body);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ data: report });
  } catch (error) {
    logger.error('Error updating report', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete('/api/v1/reports/:id', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const deleted = await reportService.deleteReport(req.params.id, tenantId);
    if (!deleted) return res.status(404).json({ error: 'Report not found' });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting report', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/v1/reports/:id/execute', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const { dateRange, filters, executedBy } = req.body;
    const execution = await reportService.executeReport(req.params.id, tenantId, {
      dateRange: dateRange ? { start: new Date(dateRange.start), end: new Date(dateRange.end) } : undefined,
      filters,
      executedBy,
    });
    res.json({ data: execution });
  } catch (error) {
    logger.error('Error executing report', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/v1/reports/executions/:id', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const execution = await reportService.getExecution(req.params.id, tenantId);
    if (!execution) return res.status(404).json({ error: 'Execution not found' });
    res.json({ data: execution });
  } catch (error) {
    logger.error('Error fetching execution', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/v1/dashboards', async (req, res) => {
  try {
    const { tenantId, name, slug, description, layout, widgets, isDefault, createdBy } = req.body;
    if (!tenantId || !name || !slug) {
      return res.status(400).json({ error: 'tenantId, name, and slug are required' });
    }
    const dashboard = await dashboardService.createDashboard({
      tenantId, name, slug, description, layout, widgets, isDefault, createdBy,
    });
    res.status(201).json({ data: dashboard });
  } catch (error) {
    logger.error('Error creating dashboard', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/v1/dashboards', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const dashboards = await dashboardService.listDashboards(tenantId);
    res.json({ data: dashboards });
  } catch (error) {
    logger.error('Error listing dashboards', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/v1/dashboards/default', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const dashboard = await dashboardService.getDefaultDashboard(tenantId);
    if (!dashboard) return res.status(404).json({ error: 'No default dashboard found' });
    res.json({ data: dashboard });
  } catch (error) {
    logger.error('Error fetching default dashboard', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/v1/dashboards/:id', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const dashboard = await dashboardService.getDashboard(req.params.id, tenantId);
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' });
    res.json({ data: dashboard });
  } catch (error) {
    logger.error('Error fetching dashboard', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.patch('/api/v1/dashboards/:id', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const dashboard = await dashboardService.updateDashboard(req.params.id, tenantId, req.body);
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' });
    res.json({ data: dashboard });
  } catch (error) {
    logger.error('Error updating dashboard', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete('/api/v1/dashboards/:id', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const deleted = await dashboardService.deleteDashboard(req.params.id, tenantId);
    if (!deleted) return res.status(404).json({ error: 'Dashboard not found' });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting dashboard', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/v1/dashboards/:id/widgets', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const { name, widgetType, config, dataSource, layout } = req.body;
    if (!name || !widgetType || !config || !dataSource) {
      return res.status(400).json({ error: 'name, widgetType, config, and dataSource are required' });
    }
    const dashboard = await dashboardService.addWidget(req.params.id, tenantId, {
      name, widgetType, config, dataSource, layout,
    });
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' });
    res.json({ data: dashboard });
  } catch (error) {
    logger.error('Error adding widget', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete('/api/v1/dashboards/:id/widgets/:widgetId', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const dashboard = await dashboardService.removeWidget(req.params.id, tenantId, req.params.widgetId);
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' });
    res.json({ data: dashboard });
  } catch (error) {
    logger.error('Error removing widget', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/v1/widgets/system', (req, res) => {
  const widgets = dashboardService.getSystemWidgets();
  res.json({ data: widgets });
});

app.post('/api/v1/export', async (req, res) => {
  try {
    const { tenantId, data, format, options } = req.body;
    if (!tenantId || !data || !format) {
      return res.status(400).json({ error: 'tenantId, data, and format are required' });
    }

    const buffer = await exportService.exportData(data, format as ExportFormat, options);
    
    const contentTypes: Record<string, string> = {
      csv: 'text/csv',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf',
    };
    const extensions: Record<string, string> = { csv: 'csv', excel: 'xlsx', pdf: 'pdf' };
    
    res.setHeader('Content-Type', contentTypes[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${options?.filename || 'export'}.${extensions[format]}"`);
    res.send(buffer);
  } catch (error) {
    logger.error('Error exporting data', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/v1/reports/:id/export', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const { format, dateRange, executedBy } = req.body;
    if (!format) return res.status(400).json({ error: 'format is required' });

    const execution = await reportService.executeReport(req.params.id, tenantId, {
      dateRange: dateRange ? { start: new Date(dateRange.start), end: new Date(dateRange.end) } : undefined,
      executedBy,
    });

    if (execution.status === 'failed') {
      return res.status(500).json({ error: execution.errorMessage });
    }

    const resultData = execution.resultData as any;
    const data = resultData?.data || [];
    
    const buffer = await exportService.exportData(data, format as ExportFormat, {
      title: req.params.id,
      filename: `report-${req.params.id}-${Date.now()}`,
    });

    const contentTypes: Record<string, string> = {
      csv: 'text/csv',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf',
    };
    const extensions: Record<string, string> = { csv: 'csv', excel: 'xlsx', pdf: 'pdf' };

    res.setHeader('Content-Type', contentTypes[format]);
    res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.id}.${extensions[format]}"`);
    res.send(buffer);
  } catch (error) {
    logger.error('Error exporting report', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

async function startServer() {
  try {
    logger.info('Starting WebWaka CB-2 Reporting & Analytics Capability...');
    await initializeDatabase();
    await runMigrations();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running at http://0.0.0.0:${PORT}`);
      logger.info('Available endpoints:');
      logger.info('  GET /              - API info');
      logger.info('  GET /health        - Health check');
      logger.info('  /api/v1/metrics    - Metrics recording and retrieval');
      logger.info('  /api/v1/aggregations - Data aggregation');
      logger.info('  /api/v1/query      - Flexible query API');
      logger.info('  /api/v1/reports    - Report management');
      logger.info('  /api/v1/dashboards - Dashboard management');
      logger.info('  /api/v1/export     - Data export (CSV, Excel, PDF)');
    });
  } catch (error) {
    logger.error('Failed to start server', { error: (error as Error).message });
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}
