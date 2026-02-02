/**
 * Unit Tests for CB-1 Commission Calculation Service
 * 
 * Tests for commission calculation logic, rules, and conditions.
 * Enforces INV-006 (MLAS as Infrastructure, Not Policy).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { CommissionCalculationService } from '../../src/services/CommissionCalculationService';
import {
  CommissionRule,
  CommissionRuleType,
  CommissionStatus,
  DisputeReason,
  DisputeStatus
} from '../../src/types';


describe('CommissionCalculationService', () => {
  let service: CommissionCalculationService;

  beforeEach(() => {
    service = new CommissionCalculationService();
  });

  describe('calculateCommission', () => {
    it('should calculate commission for single affiliate', async () => {
      const rule: CommissionRule = {
        id: 'rule-001',
        tenantId: 'tenant-001',
        organizationId: 'org-001',
        name: 'Standard Commission',
        description: '10% commission',
        ruleType: CommissionRuleType.PERCENTAGE,
        conditions: [],
        commissionStructure: {
          baseRate: new Decimal(10)
        },
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const commissions = await service.calculateCommission(
        'sale-001',
        1000,
        ['aff-001'],
        [rule]
      );

      expect(commissions).toHaveLength(1);
      expect(commissions[0].affiliateId).toBe('aff-001');
      expect(commissions[0].commissionAmount.toNumber()).toBe(100);
      expect(commissions[0].status).toBe(CommissionStatus.CALCULATED);
    });

    it('should calculate commission for affiliate chain', async () => {
      const rule: CommissionRule = {
        id: 'rule-001',
        tenantId: 'tenant-001',
        organizationId: 'org-001',
        name: 'Multi-level Commission',
        description: '10% base with tier reduction',
        ruleType: CommissionRuleType.PERCENTAGE,
        conditions: [],
        commissionStructure: {
          baseRate: new Decimal(10)
        },
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const commissions = await service.calculateCommission(
        'sale-001',
        1000,
        ['aff-001', 'aff-002', 'aff-003'],
        [rule]
      );

      expect(commissions).toHaveLength(3);
      
      // First affiliate gets full rate
      expect(commissions[0].affiliateId).toBe('aff-001');
      expect(commissions[0].commissionAmount.toNumber()).toBe(100);
      
      // Second affiliate gets reduced rate (10% reduction)
      expect(commissions[1].affiliateId).toBe('aff-002');
      expect(commissions[1].commissionAmount.toNumber()).toBe(90);
      
      // Third affiliate gets further reduced rate
      expect(commissions[2].affiliateId).toBe('aff-003');
      expect(commissions[2].commissionAmount.toNumber()).toBe(80);
    });

    it('should return empty array when no rules provided', async () => {
      const commissions = await service.calculateCommission(
        'sale-001',
        1000,
        ['aff-001'],
        []
      );

      expect(commissions).toHaveLength(0);
    });

    it('should handle Decimal sale amount', async () => {
      const rule: CommissionRule = {
        id: 'rule-001',
        tenantId: 'tenant-001',
        organizationId: 'org-001',
        name: 'Standard Commission',
        description: '10% commission',
        ruleType: CommissionRuleType.PERCENTAGE,
        conditions: [],
        commissionStructure: {
          baseRate: new Decimal(10)
        },
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const commissions = await service.calculateCommission(
        'sale-001',
        new Decimal(1000),
        ['aff-001'],
        [rule]
      );

      expect(commissions).toHaveLength(1);
      expect(commissions[0].commissionAmount.toNumber()).toBe(100);
    });
  });

  describe('Tiered Commission', () => {
    it('should apply bonus rate when threshold met', async () => {
      const rule: CommissionRule = {
        id: 'rule-001',
        tenantId: 'tenant-001',
        organizationId: 'org-001',
        name: 'Tiered Commission',
        description: 'Tiered rates',
        ruleType: CommissionRuleType.TIERED,
        conditions: [],
        commissionStructure: {
          baseRate: new Decimal(5),
          bonusRates: [
            { threshold: new Decimal(1000), rate: new Decimal(10) },
            { threshold: new Decimal(5000), rate: new Decimal(15) }
          ]
        },
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Sale below first threshold - base rate
      const commissions1 = await service.calculateCommission(
        'sale-001',
        500,
        ['aff-001'],
        [rule]
      );
      expect(commissions1[0].commissionAmount.toNumber()).toBe(25); // 5% of 500

      // Sale at first threshold - bonus rate
      const commissions2 = await service.calculateCommission(
        'sale-002',
        1000,
        ['aff-001'],
        [rule]
      );
      expect(commissions2[0].commissionAmount.toNumber()).toBe(100); // 10% of 1000

      // Sale at second threshold - higher bonus rate
      const commissions3 = await service.calculateCommission(
        'sale-003',
        5000,
        ['aff-001'],
        [rule]
      );
      expect(commissions3[0].commissionAmount.toNumber()).toBe(750); // 15% of 5000
    });
  });

  describe('Commission Cap and Minimum', () => {
    it('should apply commission cap', async () => {
      const rule: CommissionRule = {
        id: 'rule-001',
        tenantId: 'tenant-001',
        organizationId: 'org-001',
        name: 'Capped Commission',
        description: '10% with $50 cap',
        ruleType: CommissionRuleType.PERCENTAGE,
        conditions: [],
        commissionStructure: {
          baseRate: new Decimal(10),
          capAmount: new Decimal(50)
        },
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const commissions = await service.calculateCommission(
        'sale-001',
        1000,
        ['aff-001'],
        [rule]
      );

      // 10% of 1000 = 100, but capped at 50
      expect(commissions[0].commissionAmount.toNumber()).toBe(50);
    });

    it('should apply minimum commission', async () => {
      const rule: CommissionRule = {
        id: 'rule-001',
        tenantId: 'tenant-001',
        organizationId: 'org-001',
        name: 'Minimum Commission',
        description: '10% with $10 minimum',
        ruleType: CommissionRuleType.PERCENTAGE,
        conditions: [],
        commissionStructure: {
          baseRate: new Decimal(10),
          minAmount: new Decimal(10)
        },
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const commissions = await service.calculateCommission(
        'sale-001',
        50,
        ['aff-001'],
        [rule]
      );

      // 10% of 50 = 5, but minimum is 10
      expect(commissions[0].commissionAmount.toNumber()).toBe(10);
    });
  });

  describe('getCommissionsByAffiliate', () => {
    it('should return commissions for specific affiliate', async () => {
      const rule: CommissionRule = {
        id: 'rule-001',
        tenantId: 'tenant-001',
        organizationId: 'org-001',
        name: 'Standard Commission',
        description: '10% commission',
        ruleType: CommissionRuleType.PERCENTAGE,
        conditions: [],
        commissionStructure: {
          baseRate: new Decimal(10)
        },
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Create commissions for different affiliates
      await service.calculateCommission('sale-001', 1000, ['aff-001'], [rule]);
      await service.calculateCommission('sale-002', 500, ['aff-002'], [rule]);
      await service.calculateCommission('sale-003', 750, ['aff-001'], [rule]);

      const aff1Commissions = await service.getCommissionsByAffiliate('aff-001');
      const aff2Commissions = await service.getCommissionsByAffiliate('aff-002');

      expect(aff1Commissions).toHaveLength(2);
      expect(aff2Commissions).toHaveLength(1);
    });
  });

  describe('approveCommission', () => {
    it('should approve a commission', async () => {
      const rule: CommissionRule = {
        id: 'rule-001',
        tenantId: 'tenant-001',
        organizationId: 'org-001',
        name: 'Standard Commission',
        description: '10% commission',
        ruleType: CommissionRuleType.PERCENTAGE,
        conditions: [],
        commissionStructure: {
          baseRate: new Decimal(10)
        },
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const commissions = await service.calculateCommission(
        'sale-001',
        1000,
        ['aff-001'],
        [rule]
      );

      await service.approveCommission(commissions[0].id);

      const updatedCommissions = await service.getCommissionsByAffiliate('aff-001');
      expect(updatedCommissions[0].status).toBe(CommissionStatus.APPROVED);
    });

    it('should throw error for non-existent commission', async () => {
      await expect(
        service.approveCommission('non-existent')
      ).rejects.toThrow('Commission non-existent not found');
    });
  });

  describe('disputeCommission', () => {
    it('should create dispute for commission', async () => {
      const rule: CommissionRule = {
        id: 'rule-001',
        tenantId: 'tenant-001',
        organizationId: 'org-001',
        name: 'Standard Commission',
        description: '10% commission',
        ruleType: CommissionRuleType.PERCENTAGE,
        conditions: [],
        commissionStructure: {
          baseRate: new Decimal(10)
        },
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const commissions = await service.calculateCommission(
        'sale-001',
        1000,
        ['aff-001'],
        [rule]
      );

      const dispute = await service.disputeCommission(
        commissions[0].id,
        DisputeReason.INCORRECT_CALCULATION,
        'Commission seems too low'
      );

      expect(dispute.id).toBeDefined();
      expect(dispute.reason).toBe(DisputeReason.INCORRECT_CALCULATION);
      expect(dispute.status).toBe(DisputeStatus.OPEN);
      expect(dispute.commissionId).toBe(commissions[0].id);

      // Commission should be marked as disputed
      const updatedCommissions = await service.getCommissionsByAffiliate('aff-001');
      expect(updatedCommissions[0].status).toBe(CommissionStatus.DISPUTED);
    });

    it('should throw error for non-existent commission', async () => {
      await expect(
        service.disputeCommission(
          'non-existent',
          DisputeReason.OTHER,
          'Test'
        )
      ).rejects.toThrow('Commission non-existent not found');
    });
  });

  describe('validateCommission', () => {
    it('should validate commission data', async () => {
      const rule: CommissionRule = {
        id: 'rule-001',
        tenantId: 'tenant-001',
        organizationId: 'org-001',
        name: 'Standard Commission',
        description: '10% commission',
        ruleType: CommissionRuleType.PERCENTAGE,
        conditions: [],
        commissionStructure: {
          baseRate: new Decimal(10)
        },
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const commissions = await service.calculateCommission(
        'sale-001',
        1000,
        ['aff-001'],
        [rule]
      );

      const validation = service.validateCommission(commissions[0]);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('toJSON', () => {
    it('should serialize commission to JSON', async () => {
      const rule: CommissionRule = {
        id: 'rule-001',
        tenantId: 'tenant-001',
        organizationId: 'org-001',
        name: 'Standard Commission',
        description: '10% commission',
        ruleType: CommissionRuleType.PERCENTAGE,
        conditions: [],
        commissionStructure: {
          baseRate: new Decimal(10)
        },
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const commissions = await service.calculateCommission(
        'sale-001',
        1000,
        ['aff-001'],
        [rule]
      );

      const json = service.toJSON(commissions[0]);
      
      expect(json.id).toBe(commissions[0].id);
      expect(json.saleId).toBe('sale-001');
      expect(json.affiliateId).toBe('aff-001');
      expect(typeof json.commissionAmount).toBe('string'); // Decimal serialized as string
    });
  });
});
