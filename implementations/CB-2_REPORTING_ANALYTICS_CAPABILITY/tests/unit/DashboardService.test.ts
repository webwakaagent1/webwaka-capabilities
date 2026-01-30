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

import { DashboardService } from '../../src/services/DashboardService';

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
    service = new DashboardService();
  });

  describe('system widgets', () => {
    it('should have 5 standard widget types', () => {
      const widgets = service.getSystemWidgets();

      expect(widgets.length).toBe(5);
      const types = widgets.map(w => w.widgetType);
      expect(types).toContain('line_chart');
      expect(types).toContain('bar_chart');
      expect(types).toContain('pie_chart');
      expect(types).toContain('table');
      expect(types).toContain('kpi_card');
    });

    it('should get system widget by type', () => {
      const widget = service.getSystemWidget('line_chart');

      expect(widget).toBeDefined();
      expect(widget?.widgetType).toBe('line_chart');
      expect(widget?.isSystem).toBe(true);
    });
  });

  describe('createDashboard', () => {
    it('should create a dashboard', async () => {
      const now = new Date();
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'dashboard-1',
          tenant_id: 'tenant-1',
          name: 'My Dashboard',
          slug: 'my-dashboard',
          description: 'Test dashboard',
          layout: [],
          widgets: [],
          is_default: false,
          created_by: 'user-1',
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        }],
      });

      const dashboard = await service.createDashboard({
        tenantId: 'tenant-1',
        name: 'My Dashboard',
        slug: 'my-dashboard',
        description: 'Test dashboard',
        createdBy: 'user-1',
      });

      expect(dashboard.name).toBe('My Dashboard');
      expect(dashboard.widgets).toEqual([]);
    });
  });

  describe('getDashboard', () => {
    it('should return dashboard by id', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'dashboard-1',
          tenant_id: 'tenant-1',
          name: 'Dashboard',
          slug: 'dashboard',
          layout: [],
          widgets: [],
          is_default: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
      });

      const dashboard = await service.getDashboard('dashboard-1', 'tenant-1');

      expect(dashboard).toBeDefined();
      expect(dashboard?.id).toBe('dashboard-1');
    });

    it('should return null for non-existent dashboard', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const dashboard = await service.getDashboard('non-existent', 'tenant-1');

      expect(dashboard).toBeNull();
    });
  });

  describe('listDashboards', () => {
    it('should return dashboards ordered by default first', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 'd-1', tenant_id: 'tenant-1', name: 'Default', slug: 'default', layout: [], widgets: [], is_default: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'd-2', tenant_id: 'tenant-1', name: 'Other', slug: 'other', layout: [], widgets: [], is_default: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        ],
      });

      const dashboards = await service.listDashboards('tenant-1');

      expect(dashboards.length).toBe(2);
      expect(dashboards[0].isDefault).toBe(true);
    });
  });

  describe('updateDashboard', () => {
    it('should update dashboard name', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'dashboard-1',
          tenant_id: 'tenant-1',
          name: 'Updated Name',
          slug: 'dashboard',
          layout: [],
          widgets: [],
          is_default: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
      });

      const dashboard = await service.updateDashboard('dashboard-1', 'tenant-1', {
        name: 'Updated Name',
      });

      expect(dashboard?.name).toBe('Updated Name');
    });
  });

  describe('deleteDashboard', () => {
    it('should delete dashboard', async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.deleteDashboard('dashboard-1', 'tenant-1');

      expect(result).toBe(true);
    });

    it('should return false if dashboard not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await service.deleteDashboard('non-existent', 'tenant-1');

      expect(result).toBe(false);
    });
  });
});
