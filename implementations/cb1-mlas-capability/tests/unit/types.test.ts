/**
 * Unit Tests for CB-1 MLAS Types and Enums
 * 
 * Tests for type definitions, enums, and model structures.
 * Enforces INV-006 (MLAS as Infrastructure, Not Policy).
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  ActorType,
  RevenueModel,
  AffiliateStatus,
  AttributionType,
  CommissionRuleType,
  CommissionStatus,
  PayoutMethod,
  PayoutStatus,
  DisputeReason,
  DisputeStatus,
  ResolutionType,
  TransactionType,
  TransactionStatus,
  Organization,
  RevenueModelConfig,
  Affiliate,
  Attribution,
  CommissionRule,
  CommissionCalculation,
  PayoutBatch,
  Payout,
  Dispute,
  MLASTransaction
} from '../../src/types';


describe('ActorType Enum', () => {
  it('should define PLATFORM actor type', () => {
    expect(ActorType.PLATFORM).toBe('PLATFORM');
  });

  it('should define PARTNER actor type', () => {
    expect(ActorType.PARTNER).toBe('PARTNER');
  });

  it('should define CLIENT actor type', () => {
    expect(ActorType.CLIENT).toBe('CLIENT');
  });

  it('should define AFFILIATE actor type', () => {
    expect(ActorType.AFFILIATE).toBe('AFFILIATE');
  });

  it('should have exactly 4 actor types', () => {
    const actorTypes = Object.values(ActorType);
    expect(actorTypes).toHaveLength(4);
  });
});


describe('RevenueModel Enum (INV-006)', () => {
  it('should define PLATFORM_FIRST model', () => {
    expect(RevenueModel.PLATFORM_FIRST).toBe('PLATFORM_FIRST');
  });

  it('should define PARTNER_OWNED model', () => {
    expect(RevenueModel.PARTNER_OWNED).toBe('PARTNER_OWNED');
  });

  it('should define CLIENT_OWNED model', () => {
    expect(RevenueModel.CLIENT_OWNED).toBe('CLIENT_OWNED');
  });

  it('should define ZERO_PLATFORM_CUT model', () => {
    expect(RevenueModel.ZERO_PLATFORM_CUT).toBe('ZERO_PLATFORM_CUT');
  });

  it('should define HYBRID model', () => {
    expect(RevenueModel.HYBRID).toBe('HYBRID');
  });

  it('should have exactly 5 revenue models', () => {
    const models = Object.values(RevenueModel);
    expect(models).toHaveLength(5);
  });
});


describe('AffiliateStatus Enum', () => {
  it('should define all affiliate statuses', () => {
    expect(AffiliateStatus.ACTIVE).toBe('ACTIVE');
    expect(AffiliateStatus.INACTIVE).toBe('INACTIVE');
    expect(AffiliateStatus.SUSPENDED).toBe('SUSPENDED');
    expect(AffiliateStatus.TERMINATED).toBe('TERMINATED');
  });
});


describe('AttributionType Enum', () => {
  it('should define all attribution types', () => {
    expect(AttributionType.DIRECT).toBe('DIRECT');
    expect(AttributionType.REFERRAL).toBe('REFERRAL');
    expect(AttributionType.MULTI_TOUCH).toBe('MULTI_TOUCH');
    expect(AttributionType.FIRST_TOUCH).toBe('FIRST_TOUCH');
    expect(AttributionType.LAST_TOUCH).toBe('LAST_TOUCH');
  });
});


describe('CommissionRuleType Enum', () => {
  it('should define all commission rule types', () => {
    expect(CommissionRuleType.FLAT_RATE).toBe('FLAT_RATE');
    expect(CommissionRuleType.PERCENTAGE).toBe('PERCENTAGE');
    expect(CommissionRuleType.TIERED).toBe('TIERED');
    expect(CommissionRuleType.PERFORMANCE_BASED).toBe('PERFORMANCE_BASED');
    expect(CommissionRuleType.HYBRID).toBe('HYBRID');
  });
});


describe('CommissionStatus Enum', () => {
  it('should define all commission statuses', () => {
    expect(CommissionStatus.PENDING).toBe('PENDING');
    expect(CommissionStatus.CALCULATED).toBe('CALCULATED');
    expect(CommissionStatus.APPROVED).toBe('APPROVED');
    expect(CommissionStatus.DISPUTED).toBe('DISPUTED');
    expect(CommissionStatus.PAID).toBe('PAID');
    expect(CommissionStatus.CANCELLED).toBe('CANCELLED');
  });
});


describe('PayoutMethod Enum', () => {
  it('should define all payout methods', () => {
    expect(PayoutMethod.BANK_TRANSFER).toBe('BANK_TRANSFER');
    expect(PayoutMethod.PAYPAL).toBe('PAYPAL');
    expect(PayoutMethod.STRIPE).toBe('STRIPE');
    expect(PayoutMethod.CRYPTO).toBe('CRYPTO');
    expect(PayoutMethod.INTERNAL_CREDIT).toBe('INTERNAL_CREDIT');
  });
});


describe('PayoutStatus Enum', () => {
  it('should define all payout statuses', () => {
    expect(PayoutStatus.SCHEDULED).toBe('SCHEDULED');
    expect(PayoutStatus.PROCESSING).toBe('PROCESSING');
    expect(PayoutStatus.COMPLETED).toBe('COMPLETED');
    expect(PayoutStatus.FAILED).toBe('FAILED');
    expect(PayoutStatus.CANCELLED).toBe('CANCELLED');
  });
});


describe('DisputeReason Enum', () => {
  it('should define all dispute reasons', () => {
    expect(DisputeReason.INCORRECT_CALCULATION).toBe('INCORRECT_CALCULATION');
    expect(DisputeReason.DUPLICATE_COMMISSION).toBe('DUPLICATE_COMMISSION');
    expect(DisputeReason.UNAUTHORIZED_CHARGE).toBe('UNAUTHORIZED_CHARGE');
    expect(DisputeReason.QUALITY_ISSUE).toBe('QUALITY_ISSUE');
    expect(DisputeReason.OTHER).toBe('OTHER');
  });
});


describe('DisputeStatus Enum', () => {
  it('should define all dispute statuses', () => {
    expect(DisputeStatus.OPEN).toBe('OPEN');
    expect(DisputeStatus.UNDER_REVIEW).toBe('UNDER_REVIEW');
    expect(DisputeStatus.RESOLVED).toBe('RESOLVED');
    expect(DisputeStatus.APPEALED).toBe('APPEALED');
    expect(DisputeStatus.CLOSED).toBe('CLOSED');
  });
});


describe('ResolutionType Enum', () => {
  it('should define all resolution types', () => {
    expect(ResolutionType.APPROVED).toBe('APPROVED');
    expect(ResolutionType.REJECTED).toBe('REJECTED');
    expect(ResolutionType.PARTIAL_APPROVAL).toBe('PARTIAL_APPROVAL');
    expect(ResolutionType.REFUND).toBe('REFUND');
  });
});


describe('TransactionType Enum', () => {
  it('should define all transaction types', () => {
    expect(TransactionType.ATTRIBUTION_CREATED).toBe('ATTRIBUTION_CREATED');
    expect(TransactionType.COMMISSION_CALCULATED).toBe('COMMISSION_CALCULATED');
    expect(TransactionType.COMMISSION_APPROVED).toBe('COMMISSION_APPROVED');
    expect(TransactionType.COMMISSION_DISPUTED).toBe('COMMISSION_DISPUTED');
    expect(TransactionType.PAYOUT_SCHEDULED).toBe('PAYOUT_SCHEDULED');
    expect(TransactionType.PAYOUT_PROCESSED).toBe('PAYOUT_PROCESSED');
    expect(TransactionType.DISPUTE_CREATED).toBe('DISPUTE_CREATED');
    expect(TransactionType.DISPUTE_RESOLVED).toBe('DISPUTE_RESOLVED');
    expect(TransactionType.AFFILIATE_CREATED).toBe('AFFILIATE_CREATED');
    expect(TransactionType.AFFILIATE_UPDATED).toBe('AFFILIATE_UPDATED');
    expect(TransactionType.RULE_CREATED).toBe('RULE_CREATED');
    expect(TransactionType.RULE_UPDATED).toBe('RULE_UPDATED');
  });
});


describe('Organization Interface', () => {
  it('should create valid organization', () => {
    const org: Organization = {
      id: 'org-001',
      tenantId: 'tenant-001',
      name: 'Test Organization',
      type: ActorType.PARTNER,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    expect(org.id).toBe('org-001');
    expect(org.type).toBe(ActorType.PARTNER);
  });

  it('should support hierarchical structures', () => {
    const org: Organization = {
      id: 'org-002',
      tenantId: 'tenant-001',
      name: 'Child Organization',
      type: ActorType.CLIENT,
      parentId: 'org-001',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    expect(org.parentId).toBe('org-001');
  });
});


describe('RevenueModelConfig Interface', () => {
  it('should create valid revenue model config', () => {
    const config: RevenueModelConfig = {
      id: 'config-001',
      tenantId: 'tenant-001',
      model: RevenueModel.PLATFORM_FIRST,
      platformCutPercentage: new Decimal(15),
      partnerCutPercentage: new Decimal(10),
      clientCutPercentage: new Decimal(5),
      description: 'Standard revenue model',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    expect(config.model).toBe(RevenueModel.PLATFORM_FIRST);
    expect(config.platformCutPercentage.toNumber()).toBe(15);
  });
});


describe('Affiliate Interface', () => {
  it('should create valid affiliate', () => {
    const affiliate: Affiliate = {
      id: 'aff-001',
      tenantId: 'tenant-001',
      organizationId: 'org-001',
      name: 'Test Affiliate',
      email: 'affiliate@test.com',
      tier: 1,
      status: AffiliateStatus.ACTIVE,
      commissionRate: new Decimal(10),
      payoutMethod: PayoutMethod.BANK_TRANSFER,
      payoutDetails: {
        method: PayoutMethod.BANK_TRANSFER,
        accountNumber: '1234567890',
        routingNumber: '123456789',
        bankName: 'Test Bank',
        accountHolderName: 'Test Affiliate'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    expect(affiliate.tier).toBe(1);
    expect(affiliate.status).toBe(AffiliateStatus.ACTIVE);
  });

  it('should support sub-affiliates', () => {
    const subAffiliate: Affiliate = {
      id: 'aff-002',
      tenantId: 'tenant-001',
      organizationId: 'org-001',
      name: 'Sub Affiliate',
      email: 'sub@test.com',
      tier: 2,
      parentAffiliateId: 'aff-001',
      status: AffiliateStatus.ACTIVE,
      commissionRate: new Decimal(5),
      payoutMethod: PayoutMethod.PAYPAL,
      payoutDetails: {
        method: PayoutMethod.PAYPAL,
        paypalEmail: 'sub@paypal.com'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    expect(subAffiliate.tier).toBe(2);
    expect(subAffiliate.parentAffiliateId).toBe('aff-001');
  });
});


describe('Attribution Interface', () => {
  it('should create valid attribution', () => {
    const attribution: Attribution = {
      id: 'attr-001',
      tenantId: 'tenant-001',
      saleId: 'sale-001',
      affiliateId: 'aff-001',
      affiliateChain: ['aff-001', 'aff-002'],
      attributionType: AttributionType.DIRECT,
      attributionWeight: new Decimal(1),
      createdAt: new Date()
    };

    expect(attribution.affiliateChain).toHaveLength(2);
    expect(attribution.attributionWeight.toNumber()).toBe(1);
  });
});


describe('CommissionRule Interface', () => {
  it('should create valid commission rule', () => {
    const rule: CommissionRule = {
      id: 'rule-001',
      tenantId: 'tenant-001',
      organizationId: 'org-001',
      name: 'Standard Commission',
      description: 'Standard 10% commission',
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

    expect(rule.ruleType).toBe(CommissionRuleType.PERCENTAGE);
    expect(rule.commissionStructure.baseRate.toNumber()).toBe(10);
  });

  it('should support tiered commission', () => {
    const rule: CommissionRule = {
      id: 'rule-002',
      tenantId: 'tenant-001',
      organizationId: 'org-001',
      name: 'Tiered Commission',
      description: 'Tiered commission based on sale amount',
      ruleType: CommissionRuleType.TIERED,
      conditions: [],
      commissionStructure: {
        baseRate: new Decimal(5),
        bonusRates: [
          { threshold: new Decimal(1000), rate: new Decimal(7) },
          { threshold: new Decimal(5000), rate: new Decimal(10) }
        ],
        capAmount: new Decimal(500)
      },
      isActive: true,
      priority: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    expect(rule.commissionStructure.bonusRates).toHaveLength(2);
    expect(rule.commissionStructure.capAmount?.toNumber()).toBe(500);
  });
});


describe('CommissionCalculation Interface', () => {
  it('should create valid commission calculation', () => {
    const commission: CommissionCalculation = {
      id: 'comm-001',
      tenantId: 'tenant-001',
      saleId: 'sale-001',
      affiliateId: 'aff-001',
      affiliateChain: ['aff-001'],
      commissionRuleId: 'rule-001',
      grossAmount: new Decimal(1000),
      commissionAmount: new Decimal(100),
      commissionRate: new Decimal(10),
      netAmount: new Decimal(900),
      status: CommissionStatus.CALCULATED,
      calculatedAt: new Date()
    };

    expect(commission.commissionAmount.toNumber()).toBe(100);
    expect(commission.status).toBe(CommissionStatus.CALCULATED);
  });
});


describe('PayoutBatch Interface', () => {
  it('should create valid payout batch', () => {
    const batch: PayoutBatch = {
      id: 'batch-001',
      tenantId: 'tenant-001',
      batchNumber: 'BATCH-001',
      commissionIds: ['comm-001', 'comm-002'],
      totalAmount: new Decimal(500),
      status: PayoutStatus.SCHEDULED,
      scheduledDate: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    expect(batch.commissionIds).toHaveLength(2);
    expect(batch.status).toBe(PayoutStatus.SCHEDULED);
  });
});


describe('Dispute Interface', () => {
  it('should create valid dispute', () => {
    const dispute: Dispute = {
      id: 'disp-001',
      tenantId: 'tenant-001',
      commissionId: 'comm-001',
      affiliateId: 'aff-001',
      reason: DisputeReason.INCORRECT_CALCULATION,
      description: 'Commission amount seems incorrect',
      status: DisputeStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    expect(dispute.reason).toBe(DisputeReason.INCORRECT_CALCULATION);
    expect(dispute.status).toBe(DisputeStatus.OPEN);
  });
});
