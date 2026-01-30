const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
};

jest.mock('../../src/config/database', () => ({
  pool: mockPool,
}));

import { MetricsService } from '../../src/services/MetricsService';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
    service = new MetricsService();
  });

  describe('recordMetric', () => {
    it('should record a metric with all fields', async () => {
      const now = new Date();
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'metric-1',
          tenant_id: 'tenant-1',
          metric_type: 'counter',
          metric_name: 'page_views',
          value: '100',
          dimensions: { page: 'home' },
          timestamp: now.toISOString(),
          source: 'web',
          created_at: now.toISOString(),
        }],
      });

      const result = await service.recordMetric({
        tenantId: 'tenant-1',
        metricType: 'counter',
        metricName: 'page_views',
        value: 100,
        dimensions: { page: 'home' },
        source: 'web',
      });

      expect(result).toBeDefined();
      expect(result.metricName).toBe('page_views');
      expect(result.value).toBe(100);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('recordBatch', () => {
    it('should record multiple metrics in a batch', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // INSERT 1
        .mockResolvedValueOnce({}) // INSERT 2
        .mockResolvedValueOnce({}); // COMMIT

      const count = await service.recordBatch('tenant-1', [
        { metricType: 'counter', metricName: 'views', value: 10 },
        { metricType: 'counter', metricName: 'clicks', value: 5 },
      ]);

      expect(count).toBe(2);
    });

    it('should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('DB Error'));

      await expect(service.recordBatch('tenant-1', [
        { metricType: 'counter', metricName: 'views', value: 10 },
      ])).rejects.toThrow('DB Error');
    });
  });

  describe('getMetrics', () => {
    it('should return metrics with pagination', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 'm-1', tenant_id: 'tenant-1', metric_type: 'counter', metric_name: 'views', value: '10', dimensions: {}, timestamp: new Date().toISOString(), created_at: new Date().toISOString() },
          ],
        });

      const result = await service.getMetrics('tenant-1', { limit: 10, offset: 0 });

      expect(result.total).toBe(50);
      expect(result.metrics).toHaveLength(1);
    });

    it('should filter by metric name', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.getMetrics('tenant-1', { metricName: 'revenue' });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('metric_name = $2'),
        expect.arrayContaining(['tenant-1', 'revenue'])
      );
    });
  });

  describe('getMetricNames', () => {
    it('should return distinct metric names', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { metric_name: 'revenue' },
          { metric_name: 'orders' },
          { metric_name: 'users' },
        ],
      });

      const names = await service.getMetricNames('tenant-1');

      expect(names).toEqual(['revenue', 'orders', 'users']);
    });
  });
});
