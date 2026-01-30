const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
};

const mockContentItemService = {
  updateStatus: jest.fn(),
};

jest.mock('../../src/config/database', () => ({
  pool: mockPool,
}));

jest.mock('../../src/services/ContentItemService', () => ({
  contentItemService: mockContentItemService,
}));

import { WorkflowService } from '../../src/services/WorkflowService';

describe('WorkflowService', () => {
  let service: WorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
    service = new WorkflowService();
  });

  describe('createWorkflowDefinition', () => {
    it('should create a workflow with valid steps', async () => {
      const steps = [
        { name: 'Draft', status: 'draft' as const, order: 0, autoTransition: false },
        { name: 'Review', status: 'in_review' as const, order: 1, requiredApprovers: 1 },
        { name: 'Publish', status: 'published' as const, order: 2, autoTransition: true },
      ];

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            id: 'wf-1',
            tenant_id: 'tenant-1',
            name: 'My Workflow',
            slug: 'my-workflow',
            description: 'Test workflow',
            steps: steps,
            is_default: false,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({}); // COMMIT

      const result = await service.createWorkflowDefinition(
        'tenant-1',
        'My Workflow',
        'my-workflow',
        steps,
        'Test workflow'
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('My Workflow');
      expect(result.steps).toHaveLength(3);
    });

    it('should reject workflows with less than 2 steps', async () => {
      const steps = [
        { name: 'Draft', status: 'draft' as const, order: 0, autoTransition: false },
      ];

      mockClient.query.mockResolvedValueOnce({}); // BEGIN

      await expect(service.createWorkflowDefinition(
        'tenant-1',
        'Invalid',
        'invalid',
        steps
      )).rejects.toThrow('Workflow must have at least 2 steps');
    });
  });

  describe('getDefaultWorkflow', () => {
    it('should return tenant default workflow if exists', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'wf-tenant',
          tenant_id: 'tenant-1',
          name: 'Tenant Workflow',
          slug: 'tenant-workflow',
          steps: [],
          is_default: true,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const result = await service.getDefaultWorkflow('tenant-1');

      expect(result).toBeDefined();
      expect(result?.tenantId).toBe('tenant-1');
    });

    it('should fallback to system default if no tenant default', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: 'wf-system',
            tenant_id: 'system',
            name: 'System Workflow',
            slug: 'system-workflow',
            steps: [],
            is_default: true,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        });

      const result = await service.getDefaultWorkflow('tenant-1');

      expect(result).toBeDefined();
      expect(result?.tenantId).toBe('system');
    });
  });

  describe('startWorkflow', () => {
    it('should start workflow and update content status', async () => {
      const workflowDef = {
        id: 'wf-1',
        tenant_id: 'tenant-1',
        name: 'Standard',
        slug: 'standard',
        steps: [
          { name: 'Draft', status: 'draft', order: 0 },
          { name: 'Publish', status: 'published', order: 1 },
        ],
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [workflowDef] }) // get workflow def
        .mockResolvedValueOnce({ rows: [] }) // check existing instance
        .mockResolvedValueOnce({
          rows: [{
            id: 'inst-1',
            tenant_id: 'tenant-1',
            content_item_id: 'item-1',
            workflow_definition_id: 'wf-1',
            current_step: 0,
            status: 'in_progress',
            assigned_to: [],
            approvals: [],
            comments: [],
            started_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({}); // COMMIT

      mockContentItemService.updateStatus.mockResolvedValueOnce({});

      const result = await service.startWorkflow('tenant-1', 'item-1');

      expect(result).toBeDefined();
      expect(result.status).toBe('in_progress');
      expect(result.currentStep).toBe(0);
      expect(mockContentItemService.updateStatus).toHaveBeenCalledWith('item-1', 'tenant-1', 'draft');
    });

    it('should throw if content already has active workflow', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'wf-1', steps: [] }] }) // workflow def
        .mockResolvedValueOnce({ rows: [{ id: 'existing-inst' }] }); // existing instance

      await expect(service.startWorkflow('tenant-1', 'item-1'))
        .rejects.toThrow('Content already has an active workflow');
    });
  });
});
