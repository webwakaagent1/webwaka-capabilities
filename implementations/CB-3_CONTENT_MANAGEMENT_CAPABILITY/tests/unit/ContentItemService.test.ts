const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
};

const mockContentTypeService = {
  getContentType: jest.fn(),
};

jest.mock('../../src/config/database', () => ({
  pool: mockPool,
}));

jest.mock('../../src/services/ContentTypeService', () => ({
  contentTypeService: mockContentTypeService,
}));

import { ContentItemService } from '../../src/services/ContentItemService';

describe('ContentItemService', () => {
  let service: ContentItemService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
    service = new ContentItemService();
  });

  describe('createContentItem', () => {
    it('should create a content item with initial version', async () => {
      const input = {
        tenantId: 'tenant-1',
        contentTypeId: 'type-1',
        slug: 'my-article',
        title: 'My Article',
        data: { body: 'Content here' },
        authorId: 'author-1',
      };

      mockContentTypeService.getContentType.mockResolvedValueOnce({
        id: 'type-1',
        name: 'Article',
        fields: [{ name: 'body', type: 'richtext', label: 'Body', required: true, localized: false }],
      });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            id: 'item-1',
            tenant_id: 'tenant-1',
            content_type_id: 'type-1',
            slug: 'my-article',
            title: 'My Article',
            status: 'draft',
            data: { body: 'Content here' },
            localized_data: {},
            author_id: 'author-1',
            current_version: 1,
            metadata: {},
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({}) // version insert
        .mockResolvedValueOnce({}); // COMMIT

      const result = await service.createContentItem(input);

      expect(result).toBeDefined();
      expect(result.title).toBe('My Article');
      expect(result.status).toBe('draft');
      expect(result.currentVersion).toBe(1);
    });

    it('should throw error if content type not found', async () => {
      mockContentTypeService.getContentType.mockResolvedValueOnce(null);

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(service.createContentItem({
        tenantId: 'tenant-1',
        contentTypeId: 'invalid-type',
        slug: 'test',
        title: 'Test',
        data: {},
        authorId: 'author-1',
      })).rejects.toThrow('Content type not found');
    });
  });

  describe('getContentItem', () => {
    it('should return content item when found', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'item-1',
          tenant_id: 'tenant-1',
          content_type_id: 'type-1',
          slug: 'my-article',
          title: 'My Article',
          status: 'draft',
          data: {},
          localized_data: {},
          author_id: 'author-1',
          current_version: 1,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const result = await service.getContentItem('item-1', 'tenant-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('item-1');
    });

    it('should return null when not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getContentItem('not-found', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update content status to published', async () => {
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'item-1',
            tenant_id: 'tenant-1',
            content_type_id: 'type-1',
            slug: 'my-article',
            title: 'My Article',
            status: 'draft',
            data: {},
            localized_data: {},
            author_id: 'author-1',
            current_version: 3,
            metadata: {},
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'item-1',
            tenant_id: 'tenant-1',
            content_type_id: 'type-1',
            slug: 'my-article',
            title: 'My Article',
            status: 'published',
            data: {},
            localized_data: {},
            author_id: 'author-1',
            current_version: 3,
            published_version: 3,
            published_at: new Date(),
            metadata: {},
            created_at: new Date(),
            updated_at: new Date(),
          }],
        });

      const result = await service.updateStatus('item-1', 'tenant-1', 'published');

      expect(result).toBeDefined();
      expect(result?.status).toBe('published');
      expect(result?.publishedVersion).toBe(3);
    });
  });

  describe('getVersions', () => {
    it('should return version history', async () => {
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'item-1',
            tenant_id: 'tenant-1',
            content_type_id: 'type-1',
            slug: 'test',
            title: 'Test',
            status: 'draft',
            data: {},
            localized_data: {},
            author_id: 'author-1',
            current_version: 3,
            metadata: {},
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({
          rows: [
            { id: 'v-3', content_item_id: 'item-1', version: 3, data: {}, localized_data: {}, author_id: 'author-1', created_at: new Date() },
            { id: 'v-2', content_item_id: 'item-1', version: 2, data: {}, localized_data: {}, author_id: 'author-1', created_at: new Date() },
            { id: 'v-1', content_item_id: 'item-1', version: 1, data: {}, localized_data: {}, author_id: 'author-1', created_at: new Date() },
          ],
        });

      const versions = await service.getVersions('item-1', 'tenant-1');

      expect(versions).toHaveLength(3);
      expect(versions[0].version).toBe(3);
    });
  });
});
