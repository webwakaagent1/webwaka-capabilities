/**
 * Integration Tests for CB-1 MLAS End-to-End Flows
 * 
 * Tests for complete MLAS workflows including attribution, commission, and payout.
 * Enforces INV-006 (MLAS as Infrastructure, Not Policy).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { AttributionService } from '../../src/services/AttributionService';
import { CommissionCalculationService } from '../../src/services/CommissionCalculationService';
import { PayoutService } from '../../src/services/PayoutService';
import {
  AttributionType,
  CommissionRule,
  CommissionRuleType,
  CommissionStatus,
  PayoutStatus,
  RevenueModel,
  DisputeReason
} from '../../src/types';


describe('MLAS End-to-End Flows', () => {
  let attributionService: AttributionService;
  let commissionService: CommissionCalculationService;
  let payoutService: PayoutService;

  beforeEach(() => {
    attributionService = new AttributionService();
    commissionService = new CommissionCalculationService();
    payoutService = new PayoutService();
  });

  describe('Complete Sale-to-Payout Flow', () => {
    it('should process sale through complete MLAS flow', async () => {
      // Step 1: Track attribution
      const attribution = await attributionService.trackAttribution(
        'sale-001',
        'aff-001',
        ['aff-001'],
        AttributionType.DIRECT
      );
      expect(attribution.id).toBeDefined();

      // Step 2: Calculate commission
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

      const commissions = await commissionService.calculateCommission(
        attribution.saleId,
        1000,
        attribution.affiliateChain,
        [rule]
      );
      expect(commissions).toHaveLength(1);
      expect(commissions[0].commissionAmount.toNumber()).toBe(100);

      // Step 3: Approve commission
      await commissionService.approveCommission(commissions[0].id);
      const approvedCommissions = await commissionService.getCommissionsByAffiliate('aff-001');
      expect(approvedCommissions[0].status).toBe(CommissionStatus.APPROVED);

      // Step 4: Schedule payout
      const batch = await payoutService.schedulePayout(
        approvedCommissions,
        new Date(Date.now() + 86400000)
      );
      expect(batch.status).toBe(PayoutStatus.SCHEDULED);
      expect(batch.totalAmount.toNumber()).toBe(100);

      // Step 5: Process payout
      await payoutService.processPayout(batch.id);
      const stats = await payoutService.getBatchStats(batch.id);
      expect(stats.status).toBe(PayoutStatus.COMPLETED);
      expect(stats.completedPayouts).toBe(1);
    });
  });

  describe('Multi-Level Affiliate Flow', () => {
    it('should calculate commissions for affiliate chain', async () => {
      // Track attribution with multi-level chain
      const attribution = await attributionService.trackAttribution(
        'sale-001',
        'aff-001',
        ['aff-001', 'aff-002', 'aff-003'],
        AttributionType.REFERRAL
      );

      // Calculate commissions for entire chain
      const rule: CommissionRule = {
        id: 'rule-001',
        tenantId: 'tenant-001',
        organizationId: 'org-001',
        name: 'Multi-level Commission',
        description: '10% with tier reduction',
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

      const commissions = await commissionService.calculateCommission(
        attribution.saleId,
        1000,
        attribution.affiliateChain,
        [rule]
      );

      // Each affiliate in chain should get commission
      expect(commissions).toHaveLength(3);
      
      // Direct affiliate gets full rate
      expect(commissions[0].affiliateId).toBe('aff-001');
      expect(commissions[0].commissionAmount.toNumber()).toBe(100);
      
      // Sub-affiliates get reduced rates
      expect(commissions[1].affiliateId).toBe('aff-002');
      expect(commissions[1].commissionAmount.toNumber()).toBe(90);
      
      expect(commissions[2].affiliateId).toBe('aff-003');
      expect(commissions[2].commissionAmount.toNumber()).toBe(80);
    });

    it('should schedule batch payout for all affiliates', async () => {
      const attribution = await attributionService.trackAttribution(
        'sale-001',
        'aff-001',
        ['aff-001', 'aff-002'],
        AttributionType.REFERRAL
      );

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

      const commissions = await commissionService.calculateCommission(
        attribution.saleId,
        1000,
        attribution.affiliateChain,
        [rule]
      );

      // Approve all commissions
      for (const commission of commissions) {
        await commissionService.approveCommission(commission.id);
      }

      const approvedCommissions = await commissionService.getCommissionsByAffiliate('aff-001');
      const batch = await payoutService.schedulePayout(
        [...approvedCommissions, ...(await commissionService.getCommissionsByAffiliate('aff-002'))],
        new Date(Date.now() + 86400000)
      );

      expect(batch.commissionIds).toHaveLength(2);
      expect(batch.totalAmount.toNumber()).toBe(190); // 100 + 90
    });
  });

  describe('Revenue Model Support (INV-006)', () => {
    it('should support PLATFORM_FIRST revenue model', async () => {
      // Platform takes cut first, then affiliate commission
      const rule: CommissionRule = {
        id: 'rule-001',
        tenantId: 'tenant-001',
        organizationId: 'org-001',
        name: 'Platform First Model',
        description: 'Platform takes 15%, affiliate gets 10% of remainder',
        ruleType: CommissionRuleType.PERCENTAGE,
        conditions: [],
        commissionStructure: {
          baseRate: new Decimal(8.5) // 10% of 85% (after platform cut)
        },
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const commissions = await commissionService.calculateCommission(
        'sale-001',
        1000,
        ['aff-001'],
        [rule]
      );

      expect(commissions[0].commissionAmount.toNumber()).toBe(85);
    });

    it('should support PARTNER_OWNED revenue model', async () => {
      // Partner owns revenue, pays platform fee
      const rule: CommissionRule = {
        id: 'rule-001',
        tenantId: 'tenant-001',
        organizationId: 'org-001',
        name: 'Partner Owned Model',
        description: 'Partner keeps 85%, pays 15% to platform',
        ruleType: CommissionRuleType.PERCENTAGE,
        conditions: [],
        commissionStructure: {
          baseRate: new Decimal(85)
        },
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const commissions = await commissionService.calculateCommission(
        'sale-001',
        1000,
        ['partner-001'],
        [rule]
      );

      expect(commissions[0].commissionAmount.toNumber()).toBe(850);
    });

    it('should support ZERO_PLATFORM_CUT revenue model', async () => {
      // Platform takes no cut
      const rule: CommissionRule = {
        id: 'rule-001',
        tenantId: 'tenant-001',
        organizationId: 'org-001',
        name: 'Zero Platform Cut',
        description: 'Full commission to affiliate',
        ruleType: CommissionRuleType.PERCENTAGE,
        conditions: [],
        commissionStructure: {
          baseRate: new Decimal(100)
        },
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const commissions = await commissionService.calculateCommission(
        'sale-001',
        1000,
        ['aff-001'],
        [rule]
      );

      expect(commissions[0].commissionAmount.toNumber()).toBe(1000);
    });
  });

  describe('Dispute Flow', () => {
    it('should handle commission dispute', async () => {
      // Create and calculate commission
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

      const commissions = await commissionService.calculateCommission(
        'sale-001',
        1000,
        ['aff-001'],
        [rule]
      );

      // Dispute the commission
      const dispute = await commissionService.disputeCommission(
        commissions[0].id,
        DisputeReason.INCORRECT_CALCULATION,
        'Expected higher commission based on agreement'
      );

      expect(dispute.id).toBeDefined();
      expect(dispute.reason).toBe(DisputeReason.INCORRECT_CALCULATION);

      // Commission should be marked as disputed
      const updatedCommissions = await commissionService.getCommissionsByAffiliate('aff-001');
      expect(updatedCommissions[0].status).toBe(CommissionStatus.DISPUTED);
    });
  });

  describe('Attribution Weight Calculation', () => {
    it('should calculate correct weights for multi-touch attribution', async () => {
      const chainLength = 4;
      
      // Calculate weights for each position
      const weights: number[] = [];
      for (let i = 0; i < chainLength; i++) {
        const weight = attributionService.calculateAttributionWeight(chainLength, i);
        weights.push(weight.toNumber());
      }

      // First position should have highest weight
      expect(weights[0]).toBeGreaterThan(weights[1]);
      expect(weights[1]).toBeGreaterThan(weights[2]);
      expect(weights[2]).toBeGreaterThan(weights[3]);

      // All weights should sum to approximately 1
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      expect(totalWeight).toBeCloseTo(1, 10);
    });
  });

  describe('Multiple Sales Processing', () => {
    it('should process multiple sales for same affiliate', async () => {
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

      // Process multiple sales
      await attributionService.trackAttribution('sale-001', 'aff-001', ['aff-001'], AttributionType.DIRECT);
      await attributionService.trackAttribution('sale-002', 'aff-001', ['aff-001'], AttributionType.DIRECT);
      await attributionService.trackAttribution('sale-003', 'aff-001', ['aff-001'], AttributionType.DIRECT);

      await commissionService.calculateCommission('sale-001', 1000, ['aff-001'], [rule]);
      await commissionService.calculateCommission('sale-002', 500, ['aff-001'], [rule]);
      await commissionService.calculateCommission('sale-003', 750, ['aff-001'], [rule]);

      const commissions = await commissionService.getCommissionsByAffiliate('aff-001');
      expect(commissions).toHaveLength(3);

      // Total commission should be 10% of total sales
      const totalCommission = commissions.reduce(
        (sum, c) => sum.plus(c.commissionAmount),
        new Decimal(0)
      );
      expect(totalCommission.toNumber()).toBe(225); // 100 + 50 + 75
    });
  });

  describe('Batch Payout Processing', () => {
    it('should process batch with multiple affiliates', async () => {
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

      // Create commissions for multiple affiliates
      await commissionService.calculateCommission('sale-001', 1000, ['aff-001'], [rule]);
      await commissionService.calculateCommission('sale-002', 500, ['aff-002'], [rule]);
      await commissionService.calculateCommission('sale-003', 750, ['aff-003'], [rule]);

      // Approve all commissions
      const aff1Comms = await commissionService.getCommissionsByAffiliate('aff-001');
      const aff2Comms = await commissionService.getCommissionsByAffiliate('aff-002');
      const aff3Comms = await commissionService.getCommissionsByAffiliate('aff-003');

      for (const comm of [...aff1Comms, ...aff2Comms, ...aff3Comms]) {
        await commissionService.approveCommission(comm.id);
      }

      // Get updated approved commissions
      const allApproved = [
        ...(await commissionService.getCommissionsByAffiliate('aff-001')),
        ...(await commissionService.getCommissionsByAffiliate('aff-002')),
        ...(await commissionService.getCommissionsByAffiliate('aff-003'))
      ];

      // Schedule batch payout
      const batch = await payoutService.schedulePayout(
        allApproved,
        new Date(Date.now() + 86400000)
      );

      expect(batch.commissionIds).toHaveLength(3);
      expect(batch.totalAmount.toNumber()).toBe(225);

      // Process batch
      await payoutService.processPayout(batch.id);

      // Verify all payouts completed
      const stats = await payoutService.getBatchStats(batch.id);
      expect(stats.completedPayouts).toBe(3);
      expect(stats.successRate).toBe('100.00');
    });
  });
});
