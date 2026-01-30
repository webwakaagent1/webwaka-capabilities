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

import { ContentTypeService } from '../../src/services/ContentTypeService';

describe('ContentTypeService', () => {
  let service: ContentTypeService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
    service = new ContentTypeService();
  });

  describe('createContentType', () => {
    it('should create a content type with valid fields', async () => {
      const input = {
        tenantId: 'tenant-1',
        name: 'Article',
        slug: 'article',
        description: 'Blog articles',
        fields: [
          { name: 'title', type: 'text' as const, label: 'Title', required: true, localized: true },
          { name: 'body', type: 'richtext' as const, label: 'Body', required: true, localized: true },
        ],
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'uuid-1',
          tenant_id: 'tenant-1',
          name: 'Article',
          slug: 'article',
          description: 'Blog articles',
          fields: input.fields,
          is_system: false,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const result = await service.createContentType(input);

      expect(result).toBeDefined();
      expect(result.name).toBe('Article');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.fields).toHaveLength(2);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should reject duplicate field names', async () => {
      const input = {
        tenantId: 'tenant-1',
        name: 'Article',
        slug: 'article',
        fields: [
          { name: 'title', type: 'text' as const, label: 'Title', required: true, localized: false },
          { name: 'title', type: 'text' as const, label: 'Title 2', required: false, localized: false },
        ],
      };

      await expect(service.createContentType(input)).rejects.toThrow('Duplicate field name');
    });

    it('should reject invalid field types', async () => {
      const input = {
        tenantId: 'tenant-1',
        name: 'Article',
        slug: 'article',
        fields: [
          { name: 'title', type: 'invalid' as any, label: 'Title', required: true, localized: false },
        ],
      };

      await expect(service.createContentType(input)).rejects.toThrow('Invalid field type');
    });
  });

  describe('getContentType', () => {
    it('should return content type when found', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'uuid-1',
          tenant_id: 'tenant-1',
          name: 'Article',
          slug: 'article',
          fields: [],
          is_system: false,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const result = await service.getContentType('uuid-1', 'tenant-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('uuid-1');
    });

    it('should return null when not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getContentType('not-found', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('listContentTypes', () => {
    it('should return list of content types for tenant', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 'uuid-1', tenant_id: 'tenant-1', name: 'Article', slug: 'article', fields: [], is_system: false, created_at: new Date(), updated_at: new Date() },
          { id: 'uuid-2', tenant_id: 'tenant-1', name: 'Page', slug: 'page', fields: [], is_system: false, created_at: new Date(), updated_at: new Date() },
        ],
      });

      const result = await service.listContentTypes('tenant-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('updateContentType', () => {
    it('should not allow updating system content types', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'uuid-1',
          tenant_id: 'tenant-1',
          name: 'System Type',
          slug: 'system-type',
          fields: [],
          is_system: true,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      await expect(service.updateContentType('uuid-1', 'tenant-1', { name: 'New Name' }))
        .rejects.toThrow('Cannot modify system content types');
    });
  });
});
