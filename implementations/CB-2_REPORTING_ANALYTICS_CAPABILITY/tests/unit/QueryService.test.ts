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

import { QueryService } from '../../src/services/QueryService';

describe('QueryService', () => {
  let service: QueryService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
    service = new QueryService();
  });

  describe('executeQuery', () => {
    it('should execute a query with metrics', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '100' }] })
        .mockResolvedValueOnce({
          rows: [
            { period: new Date(), revenue_sum: '1000', revenue_count: '50', revenue_avg: '20' },
          ],
        });

      const result = await service.executeQuery('tenant-1', {
        metrics: ['revenue'],
        granularity: 'day',
      });

      expect(result.data).toHaveLength(1);
      expect(result.metadata.totalCount).toBe(100);
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should apply filters correctly', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '10' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.executeQuery('tenant-1', {
        metrics: ['revenue'],
        filters: [
          { field: 'dimensions.channel', operator: 'eq', value: 'web' },
        ],
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("dimensions->>'channel'"),
        expect.any(Array)
      );
    });

    it('should handle date range presets', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.executeQuery('tenant-1', {
        metrics: ['revenue'],
        dateRange: { preset: 'last_7_days' },
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('timestamp >='),
        expect.any(Array)
      );
    });

    it('should group by dimensions', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '3' }] })
        .mockResolvedValueOnce({
          rows: [
            { 'dimensions.channel': 'web', revenue_sum: '500' },
            { 'dimensions.channel': 'mobile', revenue_sum: '300' },
          ],
        });

      const result = await service.executeQuery('tenant-1', {
        metrics: ['revenue'],
        groupBy: ['dimensions.channel'],
      });

      expect(result.data).toHaveLength(2);
    });
  });

  describe('getAvailableDimensions', () => {
    it('should return available dimensions', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { dimension_key: 'channel' },
          { dimension_key: 'region' },
          { dimension_key: 'product' },
        ],
      });

      const dimensions = await service.getAvailableDimensions('tenant-1');

      expect(dimensions).toEqual(['channel', 'region', 'product']);
    });

    it('should filter by metric name', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ dimension_key: 'product' }],
      });

      await service.getAvailableDimensions('tenant-1', 'revenue');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('metric_name = $2'),
        ['tenant-1', 'revenue']
      );
    });
  });
});
