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

import { ReportService } from '../../src/services/ReportService';

describe('ReportService', () => {
  let service: ReportService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
    service = new ReportService();
  });

  describe('system reports', () => {
    it('should have 10 pre-built system reports', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const reports = await service.listReports('tenant-1', { includeSystem: true });

      const systemReports = reports.filter(r => r.isSystem);
      expect(systemReports.length).toBe(10);
    });

    it('should include standard report types', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const reports = await service.listReports('tenant-1');
      const reportNames = reports.map(r => r.name);

      expect(reportNames).toContain('Sales Summary');
      expect(reportNames).toContain('Inventory Status');
      expect(reportNames).toContain('User Activity');
      expect(reportNames).toContain('Financial Overview');
      expect(reportNames).toContain('Top Products');
      expect(reportNames).toContain('Customer Segments');
    });
  });

  describe('createReport', () => {
    it('should create a custom report', async () => {
      const now = new Date();
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'report-1',
          tenant_id: 'tenant-1',
          name: 'My Report',
          slug: 'my-report',
          description: 'Custom report',
          report_type: 'custom',
          config: { metrics: ['revenue'] },
          is_system: false,
          created_by: 'user-1',
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        }],
      });

      const report = await service.createReport({
        tenantId: 'tenant-1',
        name: 'My Report',
        slug: 'my-report',
        description: 'Custom report',
        config: { metrics: ['revenue'] },
        createdBy: 'user-1',
      });

      expect(report.name).toBe('My Report');
      expect(report.isSystem).toBe(false);
    });
  });

  describe('getReport', () => {
    it('should return system report', async () => {
      const report = await service.getReport('system-sales-summary', 'tenant-1');

      expect(report).toBeDefined();
      expect(report?.name).toBe('Sales Summary');
      expect(report?.isSystem).toBe(true);
    });

    it('should return tenant report', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'report-1',
          tenant_id: 'tenant-1',
          name: 'Custom',
          slug: 'custom',
          report_type: 'custom',
          config: { metrics: [] },
          is_system: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
      });

      const report = await service.getReport('custom', 'tenant-1');

      expect(report).toBeDefined();
      expect(report?.slug).toBe('custom');
    });

    it('should return null for non-existent report', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const report = await service.getReport('non-existent', 'tenant-1');

      expect(report).toBeNull();
    });
  });

  describe('updateReport', () => {
    it('should not allow updating system reports', async () => {
      await expect(service.updateReport('system-sales-summary', 'tenant-1', {
        name: 'Modified',
      })).rejects.toThrow('Cannot modify system reports');
    });
  });

  describe('deleteReport', () => {
    it('should not allow deleting system reports', async () => {
      await expect(service.deleteReport('system-sales-summary', 'tenant-1'))
        .rejects.toThrow('Cannot delete system reports');
    });
  });
});
