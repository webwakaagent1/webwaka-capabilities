/**
 * Unit Tests for CB-1 Attribution Service
 * 
 * Tests for attribution tracking and affiliate chain management.
 * Enforces INV-006 (MLAS as Infrastructure, Not Policy).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { AttributionService } from '../../src/services/AttributionService';
import { AttributionType } from '../../src/types';


describe('AttributionService', () => {
  let service: AttributionService;

  beforeEach(() => {
    service = new AttributionService();
  });

  describe('trackAttribution', () => {
    it('should create attribution for direct sale', async () => {
      const attribution = await service.trackAttribution(
        'sale-001',
        'aff-001',
        ['aff-001'],
        AttributionType.DIRECT
      );

      expect(attribution.id).toBeDefined();
      expect(attribution.saleId).toBe('sale-001');
      expect(attribution.affiliateId).toBe('aff-001');
      expect(attribution.affiliateChain).toContain('aff-001');
      expect(attribution.attributionType).toBe(AttributionType.DIRECT);
      expect(attribution.attributionWeight.toNumber()).toBe(1);
    });

    it('should create attribution with affiliate chain', async () => {
      const attribution = await service.trackAttribution(
        'sale-001',
        'aff-001',
        ['aff-001', 'aff-002', 'aff-003'],
        AttributionType.REFERRAL
      );

      expect(attribution.affiliateChain).toHaveLength(3);
      expect(attribution.affiliateChain[0]).toBe('aff-001');
      expect(attribution.affiliateChain[2]).toBe('aff-003');
    });

    it('should add affiliate to chain if not present', async () => {
      const attribution = await service.trackAttribution(
        'sale-001',
        'aff-001',
        ['aff-002', 'aff-003'],
        AttributionType.REFERRAL
      );

      expect(attribution.affiliateChain).toContain('aff-001');
      expect(attribution.affiliateChain[0]).toBe('aff-001');
    });

    it('should throw error for invalid parameters', async () => {
      await expect(
        service.trackAttribution('', 'aff-001', ['aff-001'], AttributionType.DIRECT)
      ).rejects.toThrow('Invalid attribution parameters');

      await expect(
        service.trackAttribution('sale-001', '', ['aff-001'], AttributionType.DIRECT)
      ).rejects.toThrow('Invalid attribution parameters');

      await expect(
        service.trackAttribution('sale-001', 'aff-001', [], AttributionType.DIRECT)
      ).rejects.toThrow('Invalid attribution parameters');
    });

    it('should support multi-touch attribution', async () => {
      const attribution = await service.trackAttribution(
        'sale-001',
        'aff-001',
        ['aff-001', 'aff-002'],
        AttributionType.MULTI_TOUCH
      );

      expect(attribution.attributionType).toBe(AttributionType.MULTI_TOUCH);
    });

    it('should support first-touch attribution', async () => {
      const attribution = await service.trackAttribution(
        'sale-001',
        'aff-001',
        ['aff-001'],
        AttributionType.FIRST_TOUCH
      );

      expect(attribution.attributionType).toBe(AttributionType.FIRST_TOUCH);
    });

    it('should support last-touch attribution', async () => {
      const attribution = await service.trackAttribution(
        'sale-001',
        'aff-001',
        ['aff-001'],
        AttributionType.LAST_TOUCH
      );

      expect(attribution.attributionType).toBe(AttributionType.LAST_TOUCH);
    });
  });

  describe('getAttributionBySale', () => {
    it('should return attributions for specific sale', async () => {
      await service.trackAttribution('sale-001', 'aff-001', ['aff-001'], AttributionType.DIRECT);
      await service.trackAttribution('sale-001', 'aff-002', ['aff-002'], AttributionType.REFERRAL);
      await service.trackAttribution('sale-002', 'aff-003', ['aff-003'], AttributionType.DIRECT);

      const attributions = await service.getAttributionBySale('sale-001');

      expect(attributions).toHaveLength(2);
      expect(attributions.every(a => a.saleId === 'sale-001')).toBe(true);
    });

    it('should return empty array for non-existent sale', async () => {
      const attributions = await service.getAttributionBySale('non-existent');
      expect(attributions).toHaveLength(0);
    });
  });

  describe('getAttributionsByAffiliate', () => {
    it('should return attributions where affiliate is in chain', async () => {
      await service.trackAttribution('sale-001', 'aff-001', ['aff-001', 'aff-002'], AttributionType.DIRECT);
      await service.trackAttribution('sale-002', 'aff-003', ['aff-003', 'aff-002'], AttributionType.REFERRAL);
      await service.trackAttribution('sale-003', 'aff-004', ['aff-004'], AttributionType.DIRECT);

      // aff-002 is in chain for sale-001 and sale-002
      const attributions = await service.getAttributionsByAffiliate('aff-002');

      expect(attributions).toHaveLength(2);
    });

    it('should return empty array for affiliate not in any chain', async () => {
      await service.trackAttribution('sale-001', 'aff-001', ['aff-001'], AttributionType.DIRECT);

      const attributions = await service.getAttributionsByAffiliate('aff-999');
      expect(attributions).toHaveLength(0);
    });
  });

  describe('calculateAttributionWeight', () => {
    it('should return 1 for single affiliate chain', () => {
      const weight = service.calculateAttributionWeight(1, 0);
      expect(weight.toNumber()).toBe(1);
    });

    it('should return higher weight for earlier positions', () => {
      const chainLength = 3;
      
      const weight0 = service.calculateAttributionWeight(chainLength, 0);
      const weight1 = service.calculateAttributionWeight(chainLength, 1);
      const weight2 = service.calculateAttributionWeight(chainLength, 2);

      expect(weight0.greaterThan(weight1)).toBe(true);
      expect(weight1.greaterThan(weight2)).toBe(true);
    });

    it('should sum to approximately 1 for all positions', () => {
      const chainLength = 4;
      let totalWeight = new Decimal(0);

      for (let i = 0; i < chainLength; i++) {
        totalWeight = totalWeight.plus(service.calculateAttributionWeight(chainLength, i));
      }

      // Should be very close to 1
      expect(totalWeight.toNumber()).toBeCloseTo(1, 10);
    });
  });

  describe('getAffiliateChain', () => {
    it('should return affiliate chain from attribution', async () => {
      const attribution = await service.trackAttribution(
        'sale-001',
        'aff-001',
        ['aff-001', 'aff-002', 'aff-003'],
        AttributionType.REFERRAL
      );

      const attributions = await service.getAttributionBySale('sale-001');
      const chain = service.getAffiliateChain('aff-001', attributions);

      expect(chain).toEqual(['aff-001', 'aff-002', 'aff-003']);
    });

    it('should return single-item array for unknown affiliate', async () => {
      const chain = service.getAffiliateChain('aff-999', []);
      expect(chain).toEqual(['aff-999']);
    });
  });

  describe('validateAttribution', () => {
    it('should validate valid attribution', async () => {
      const attribution = await service.trackAttribution(
        'sale-001',
        'aff-001',
        ['aff-001'],
        AttributionType.DIRECT
      );

      const validation = service.validateAttribution(attribution);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should fail validation for missing sale ID', async () => {
      const attribution = {
        id: 'attr-001',
        tenantId: 'tenant-001',
        saleId: '',
        affiliateId: 'aff-001',
        affiliateChain: ['aff-001'],
        attributionType: AttributionType.DIRECT,
        attributionWeight: new Decimal(1),
        createdAt: new Date()
      };

      const validation = service.validateAttribution(attribution);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Sale ID is required');
    });

    it('should fail validation for missing affiliate ID', async () => {
      const attribution = {
        id: 'attr-001',
        tenantId: 'tenant-001',
        saleId: 'sale-001',
        affiliateId: '',
        affiliateChain: ['aff-001'],
        attributionType: AttributionType.DIRECT,
        attributionWeight: new Decimal(1),
        createdAt: new Date()
      };

      const validation = service.validateAttribution(attribution);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Affiliate ID is required');
    });

    it('should fail validation for empty affiliate chain', async () => {
      const attribution = {
        id: 'attr-001',
        tenantId: 'tenant-001',
        saleId: 'sale-001',
        affiliateId: 'aff-001',
        affiliateChain: [],
        attributionType: AttributionType.DIRECT,
        attributionWeight: new Decimal(1),
        createdAt: new Date()
      };

      const validation = service.validateAttribution(attribution);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Affiliate chain is required');
    });

    it('should fail validation when affiliate not in chain', async () => {
      const attribution = {
        id: 'attr-001',
        tenantId: 'tenant-001',
        saleId: 'sale-001',
        affiliateId: 'aff-001',
        affiliateChain: ['aff-002'],
        attributionType: AttributionType.DIRECT,
        attributionWeight: new Decimal(1),
        createdAt: new Date()
      };

      const validation = service.validateAttribution(attribution);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Affiliate must be in the affiliate chain');
    });

    it('should fail validation for invalid attribution weight', async () => {
      const attribution = {
        id: 'attr-001',
        tenantId: 'tenant-001',
        saleId: 'sale-001',
        affiliateId: 'aff-001',
        affiliateChain: ['aff-001'],
        attributionType: AttributionType.DIRECT,
        attributionWeight: new Decimal(-0.5),
        createdAt: new Date()
      };

      const validation = service.validateAttribution(attribution);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Attribution weight must be between 0 and 1');
    });
  });

  describe('toJSON', () => {
    it('should serialize attribution to JSON', async () => {
      const attribution = await service.trackAttribution(
        'sale-001',
        'aff-001',
        ['aff-001', 'aff-002'],
        AttributionType.REFERRAL
      );

      const json = service.toJSON(attribution);

      expect(json.id).toBe(attribution.id);
      expect(json.saleId).toBe('sale-001');
      expect(json.affiliateId).toBe('aff-001');
      expect(json.affiliateChain).toEqual(['aff-001', 'aff-002']);
      expect(json.attributionType).toBe(AttributionType.REFERRAL);
      expect(typeof json.attributionWeight).toBe('string');
      expect(typeof json.createdAt).toBe('string');
    });
  });
});
