const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
  query: jest.fn(),
};

jest.mock('../../src/config/database', () => ({
  pool: mockPool,
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  runMigrations: jest.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import { app } from '../../src/index';

describe('CB-2 Reporting & Analytics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
  });

  describe('GET /', () => {
    it('should return API info', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body.service).toBe('WebWaka CB-2 Reporting & Analytics Capability');
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.endpoints).toBeDefined();
    });
  });

  describe('GET /health', () => {
    it('should return healthy when database connected', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('Metrics API', () => {
    describe('POST /api/v1/metrics', () => {
      it('should require tenantId', async () => {
        const response = await request(app)
          .post('/api/v1/metrics')
          .send({ metricType: 'counter', metricName: 'test', value: 1 });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('tenantId');
      });

      it('should record a metric', async () => {
        mockClient.query.mockResolvedValueOnce({
          rows: [{
            id: 'metric-1',
            tenant_id: 'tenant-1',
            metric_type: 'counter',
            metric_name: 'page_views',
            value: '100',
            dimensions: {},
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }],
        });

        const response = await request(app)
          .post('/api/v1/metrics')
          .send({
            tenantId: 'tenant-1',
            metricType: 'counter',
            metricName: 'page_views',
            value: 100,
          });

        expect(response.status).toBe(201);
        expect(response.body.data.metricName).toBe('page_views');
      });
    });

    describe('GET /api/v1/metrics', () => {
      it('should require tenantId', async () => {
        const response = await request(app).get('/api/v1/metrics');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('tenantId is required');
      });

      it('should return metrics for tenant', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ count: '10' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get('/api/v1/metrics')
          .query({ tenantId: 'tenant-1' });

        expect(response.status).toBe(200);
        expect(response.body.total).toBe(10);
      });
    });
  });

  describe('Query API', () => {
    describe('POST /api/v1/query', () => {
      it('should require tenantId', async () => {
        const response = await request(app)
          .post('/api/v1/query')
          .send({ metrics: ['revenue'] });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('tenantId is required');
      });

      it('should require metrics array', async () => {
        const response = await request(app)
          .post('/api/v1/query')
          .send({ tenantId: 'tenant-1' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('metrics');
      });

      it('should execute query successfully', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ total: '5' }] })
          .mockResolvedValueOnce({ rows: [{ revenue_sum: '1000' }] });

        const response = await request(app)
          .post('/api/v1/query')
          .send({
            tenantId: 'tenant-1',
            metrics: ['revenue'],
            dateRange: { preset: 'last_7_days' },
          });

        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        expect(response.body.metadata).toBeDefined();
      });
    });
  });

  describe('Reports API', () => {
    describe('GET /api/v1/reports', () => {
      it('should require tenantId', async () => {
        const response = await request(app).get('/api/v1/reports');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('tenantId is required');
      });

      it('should return reports including system reports', async () => {
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get('/api/v1/reports')
          .query({ tenantId: 'tenant-1' });

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeGreaterThanOrEqual(10);
      });
    });

    describe('POST /api/v1/reports', () => {
      it('should create a custom report', async () => {
        mockClient.query.mockResolvedValueOnce({
          rows: [{
            id: 'report-1',
            tenant_id: 'tenant-1',
            name: 'Custom Report',
            slug: 'custom-report',
            report_type: 'custom',
            config: { metrics: ['revenue'] },
            is_system: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }],
        });

        const response = await request(app)
          .post('/api/v1/reports')
          .send({
            tenantId: 'tenant-1',
            name: 'Custom Report',
            slug: 'custom-report',
            config: { metrics: ['revenue'] },
          });

        expect(response.status).toBe(201);
        expect(response.body.data.name).toBe('Custom Report');
      });
    });
  });

  describe('Dashboards API', () => {
    describe('GET /api/v1/dashboards', () => {
      it('should require tenantId', async () => {
        const response = await request(app).get('/api/v1/dashboards');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('tenantId is required');
      });

      it('should return dashboards for tenant', async () => {
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get('/api/v1/dashboards')
          .query({ tenantId: 'tenant-1' });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([]);
      });
    });

    describe('POST /api/v1/dashboards', () => {
      it('should create a dashboard', async () => {
        mockClient.query.mockResolvedValueOnce({
          rows: [{
            id: 'dashboard-1',
            tenant_id: 'tenant-1',
            name: 'Main Dashboard',
            slug: 'main-dashboard',
            layout: [],
            widgets: [],
            is_default: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }],
        });

        const response = await request(app)
          .post('/api/v1/dashboards')
          .send({
            tenantId: 'tenant-1',
            name: 'Main Dashboard',
            slug: 'main-dashboard',
            isDefault: true,
          });

        expect(response.status).toBe(201);
        expect(response.body.data.name).toBe('Main Dashboard');
      });
    });
  });

  describe('Widgets API', () => {
    describe('GET /api/v1/widgets/system', () => {
      it('should return system widgets', async () => {
        const response = await request(app).get('/api/v1/widgets/system');

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBe(5);
      });
    });
  });

  describe('Export API', () => {
    describe('POST /api/v1/export', () => {
      it('should require tenantId, data, and format', async () => {
        const response = await request(app)
          .post('/api/v1/export')
          .send({ format: 'csv' });

        expect(response.status).toBe(400);
      });

      it('should export data to CSV', async () => {
        const response = await request(app)
          .post('/api/v1/export')
          .send({
            tenantId: 'tenant-1',
            data: [{ name: 'Test', value: 100 }],
            format: 'csv',
          });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/csv');
      });
    });
  });
});
