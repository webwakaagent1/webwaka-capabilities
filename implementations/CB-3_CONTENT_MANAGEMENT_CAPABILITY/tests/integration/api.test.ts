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
}));

import request from 'supertest';
import { app } from '../../src/index';

describe('CB-3 Content Management API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
  });

  describe('GET /', () => {
    it('should return API info', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body.service).toBe('WebWaka CB-3 Content Management Capability');
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

  describe('Content Types API', () => {
    describe('POST /api/v1/content-types', () => {
      it('should require tenantId', async () => {
        const response = await request(app)
          .post('/api/v1/content-types')
          .send({
            name: 'Article',
            slug: 'article',
            fields: [],
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('tenantId');
      });

      it('should create content type with valid input', async () => {
        mockClient.query.mockResolvedValueOnce({
          rows: [{
            id: 'uuid-1',
            tenant_id: 'tenant-1',
            name: 'Article',
            slug: 'article',
            fields: [{ name: 'title', type: 'text', label: 'Title', required: true, localized: false }],
            is_system: false,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        });

        const response = await request(app)
          .post('/api/v1/content-types')
          .send({
            tenantId: 'tenant-1',
            name: 'Article',
            slug: 'article',
            fields: [{ name: 'title', type: 'text', label: 'Title', required: true, localized: false }],
          });

        expect(response.status).toBe(201);
        expect(response.body.data.name).toBe('Article');
      });
    });

    describe('GET /api/v1/content-types', () => {
      it('should require tenantId', async () => {
        const response = await request(app).get('/api/v1/content-types');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('tenantId is required');
      });

      it('should return content types for tenant', async () => {
        mockClient.query.mockResolvedValueOnce({
          rows: [
            { id: 'uuid-1', tenant_id: 'tenant-1', name: 'Article', slug: 'article', fields: [], is_system: false, created_at: new Date(), updated_at: new Date() },
          ],
        });

        const response = await request(app)
          .get('/api/v1/content-types')
          .query({ tenantId: 'tenant-1' });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
      });
    });
  });

  describe('Content Items API', () => {
    describe('GET /api/v1/content', () => {
      it('should require tenantId', async () => {
        const response = await request(app).get('/api/v1/content');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('tenantId is required');
      });

      it('should return content items for tenant', async () => {
        mockClient.query.mockResolvedValueOnce({
          rows: [
            {
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
            },
          ],
        });

        const response = await request(app)
          .get('/api/v1/content')
          .query({ tenantId: 'tenant-1' });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
      });
    });
  });

  describe('Media API', () => {
    describe('GET /api/v1/media', () => {
      it('should require tenantId', async () => {
        const response = await request(app).get('/api/v1/media');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('tenantId is required');
      });

      it('should return media assets for tenant', async () => {
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get('/api/v1/media')
          .query({ tenantId: 'tenant-1' });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(0);
      });
    });
  });

  describe('Locales API', () => {
    describe('GET /api/v1/locales', () => {
      it('should require tenantId', async () => {
        const response = await request(app).get('/api/v1/locales');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('tenantId is required');
      });

      it('should return locales for tenant', async () => {
        mockClient.query.mockResolvedValueOnce({
          rows: [
            { id: 'loc-1', tenant_id: 'tenant-1', code: 'en', name: 'English', is_default: true, is_active: true, created_at: new Date(), updated_at: new Date() },
          ],
        });

        const response = await request(app)
          .get('/api/v1/locales')
          .query({ tenantId: 'tenant-1' });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
      });
    });
  });

  describe('Workflows API', () => {
    describe('GET /api/v1/workflows', () => {
      it('should require tenantId', async () => {
        const response = await request(app).get('/api/v1/workflows');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('tenantId is required');
      });

      it('should return workflows for tenant', async () => {
        mockClient.query.mockResolvedValueOnce({
          rows: [
            { id: 'wf-1', tenant_id: 'system', name: 'Standard Publishing', slug: 'standard-publishing', steps: [], is_default: true, created_at: new Date(), updated_at: new Date() },
          ],
        });

        const response = await request(app)
          .get('/api/v1/workflows')
          .query({ tenantId: 'tenant-1' });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
      });
    });
  });
});
