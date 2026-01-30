import { EventService } from '../src/services/EventService';
import { AuditService } from '../src/services/AuditService';

describe('EventService', () => {
  let eventService: EventService;

  beforeEach(() => {
    eventService = new EventService();
  });

  describe('generateSignature', () => {
    it('should generate consistent HMAC-SHA256 signatures', () => {
      const event = {
        id: 'event-123',
        tenantId: 'tenant-456',
        eventType: 'stock_updated' as const,
        payload: { productId: 'prod-123', quantity: 100 },
        createdAt: new Date()
      };
      const secret = 'test-secret';

      const signature1 = (eventService as any).generateSignature(event, secret);
      const signature2 = (eventService as any).generateSignature(event, secret);

      expect(signature1).toBe(signature2);
      expect(signature1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate different signatures for different payloads', () => {
      const event1 = {
        id: 'event-1',
        tenantId: 'tenant-1',
        eventType: 'stock_updated' as const,
        payload: { productId: 'prod-123' },
        createdAt: new Date()
      };
      const event2 = {
        id: 'event-2',
        tenantId: 'tenant-1',
        eventType: 'stock_low' as const,
        payload: { productId: 'prod-456' },
        createdAt: new Date()
      };
      const secret = 'test-secret';

      const signature1 = (eventService as any).generateSignature(event1, secret);
      const signature2 = (eventService as any).generateSignature(event2, secret);

      expect(signature1).not.toBe(signature2);
    });

    it('should generate different signatures for different secrets', () => {
      const event = {
        id: 'event-123',
        tenantId: 'tenant-456',
        eventType: 'stock_updated' as const,
        payload: { productId: 'prod-123' },
        createdAt: new Date()
      };
      const secret1 = 'secret-1';
      const secret2 = 'secret-2';

      const signature1 = (eventService as any).generateSignature(event, secret1);
      const signature2 = (eventService as any).generateSignature(event, secret2);

      expect(signature1).not.toBe(signature2);
    });

    it('should return empty string when no apiKey provided', () => {
      const event = {
        id: 'event-123',
        tenantId: 'tenant-456',
        eventType: 'stock_updated' as const,
        payload: { productId: 'prod-123' },
        createdAt: new Date()
      };

      const signature = (eventService as any).generateSignature(event, undefined);
      expect(signature).toBe('');
    });
  });
});

describe('AuditService', () => {
  let auditService: AuditService;

  beforeEach(() => {
    auditService = new AuditService();
  });

  describe('instance', () => {
    it('should be instantiable', () => {
      expect(auditService).toBeDefined();
      expect(auditService).toBeInstanceOf(AuditService);
    });
  });
});

describe('Inventory Strategy Logic', () => {
  describe('FIFO Batch Selection', () => {
    interface Batch {
      id: string;
      receivedAt: Date;
      remainingQuantity: number;
      costPerUnit: number;
    }

    const selectBatchesFIFO = (batches: Batch[], quantity: number): { batchId: string; quantity: number; cost: number }[] => {
      const sorted = [...batches].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
      const result: { batchId: string; quantity: number; cost: number }[] = [];
      let remaining = quantity;

      for (const batch of sorted) {
        if (remaining <= 0) break;
        const take = Math.min(batch.remainingQuantity, remaining);
        result.push({ batchId: batch.id, quantity: take, cost: batch.costPerUnit });
        remaining -= take;
      }

      return result;
    };

    it('should select oldest batch first', () => {
      const batches: Batch[] = [
        { id: 'b1', receivedAt: new Date('2026-01-15'), remainingQuantity: 10, costPerUnit: 110 },
        { id: 'b2', receivedAt: new Date('2026-01-01'), remainingQuantity: 10, costPerUnit: 100 },
        { id: 'b3', receivedAt: new Date('2026-01-30'), remainingQuantity: 10, costPerUnit: 120 },
      ];

      const selected = selectBatchesFIFO(batches, 5);

      expect(selected).toHaveLength(1);
      expect(selected[0].batchId).toBe('b2');
      expect(selected[0].cost).toBe(100);
    });

    it('should span multiple batches when needed', () => {
      const batches: Batch[] = [
        { id: 'b1', receivedAt: new Date('2026-01-01'), remainingQuantity: 5, costPerUnit: 100 },
        { id: 'b2', receivedAt: new Date('2026-01-15'), remainingQuantity: 10, costPerUnit: 110 },
      ];

      const selected = selectBatchesFIFO(batches, 8);

      expect(selected).toHaveLength(2);
      expect(selected[0].batchId).toBe('b1');
      expect(selected[0].quantity).toBe(5);
      expect(selected[1].batchId).toBe('b2');
      expect(selected[1].quantity).toBe(3);
    });
  });

  describe('LIFO Batch Selection', () => {
    interface Batch {
      id: string;
      receivedAt: Date;
      remainingQuantity: number;
      costPerUnit: number;
    }

    const selectBatchesLIFO = (batches: Batch[], quantity: number): { batchId: string; quantity: number; cost: number }[] => {
      const sorted = [...batches].sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
      const result: { batchId: string; quantity: number; cost: number }[] = [];
      let remaining = quantity;

      for (const batch of sorted) {
        if (remaining <= 0) break;
        const take = Math.min(batch.remainingQuantity, remaining);
        result.push({ batchId: batch.id, quantity: take, cost: batch.costPerUnit });
        remaining -= take;
      }

      return result;
    };

    it('should select newest batch first', () => {
      const batches: Batch[] = [
        { id: 'b1', receivedAt: new Date('2026-01-15'), remainingQuantity: 10, costPerUnit: 110 },
        { id: 'b2', receivedAt: new Date('2026-01-01'), remainingQuantity: 10, costPerUnit: 100 },
        { id: 'b3', receivedAt: new Date('2026-01-30'), remainingQuantity: 10, costPerUnit: 120 },
      ];

      const selected = selectBatchesLIFO(batches, 5);

      expect(selected).toHaveLength(1);
      expect(selected[0].batchId).toBe('b3');
      expect(selected[0].cost).toBe(120);
    });
  });
});
