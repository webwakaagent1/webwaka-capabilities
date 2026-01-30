/**
 * Affiliate Model
 * 
 * Represents an affiliate in the MLAS system. Affiliates are entities that
 * generate sales and earn commissions. They can be organized in hierarchies
 * to support multi-level affiliate structures.
 */

import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { Affiliate, AffiliateStatus, PayoutMethod, PayoutDetails } from '../types';

export class AffiliateModel {
  /**
   * Create a new affiliate
   */
  static create(
    tenantId: string,
    organizationId: string,
    name: string,
    email: string,
    commissionRate: Decimal | number,
    payoutMethod: PayoutMethod,
    payoutDetails: PayoutDetails,
    parentAffiliateId?: string,
  ): Affiliate {
    return {
      id: uuidv4(),
      tenantId,
      organizationId,
      name,
      email,
      tier: parentAffiliateId ? 2 : 1,
      parentAffiliateId,
      status: AffiliateStatus.ACTIVE,
      commissionRate: new Decimal(commissionRate),
      payoutMethod,
      payoutDetails,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Validate affiliate data
   */
  static validate(affiliate: Affiliate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!affiliate.name || affiliate.name.trim().length === 0) {
      errors.push('Affiliate name is required');
    }

    if (!affiliate.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(affiliate.email)) {
      errors.push('Valid email address is required');
    }

    if (affiliate.commissionRate.isNegative() || affiliate.commissionRate.greaterThan(100)) {
      errors.push('Commission rate must be between 0 and 100');
    }

    if (!affiliate.payoutMethod) {
      errors.push('Payout method is required');
    }

    if (!affiliate.payoutDetails) {
      errors.push('Payout details are required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Update affiliate status
   */
  static updateStatus(affiliate: Affiliate, newStatus: AffiliateStatus): Affiliate {
    return {
      ...affiliate,
      status: newStatus,
      updatedAt: new Date(),
    };
  }

  /**
   * Update commission rate
   */
  static updateCommissionRate(affiliate: Affiliate, newRate: Decimal | number): Affiliate {
    return {
      ...affiliate,
      commissionRate: new Decimal(newRate),
      updatedAt: new Date(),
    };
  }

  /**
   * Update payout details
   */
  static updatePayoutDetails(affiliate: Affiliate, payoutDetails: PayoutDetails): Affiliate {
    return {
      ...affiliate,
      payoutDetails,
      updatedAt: new Date(),
    };
  }

  /**
   * Check if affiliate is active
   */
  static isActive(affiliate: Affiliate): boolean {
    return affiliate.status === AffiliateStatus.ACTIVE;
  }

  /**
   * Calculate tier based on parent affiliate
   */
  static calculateTier(parentAffiliate?: Affiliate): number {
    if (!parentAffiliate) {
      return 1;
    }
    return parentAffiliate.tier + 1;
  }

  /**
   * Serialize affiliate to JSON
   */
  static toJSON(affiliate: Affiliate): Record<string, unknown> {
    return {
      id: affiliate.id,
      tenantId: affiliate.tenantId,
      organizationId: affiliate.organizationId,
      name: affiliate.name,
      email: affiliate.email,
      tier: affiliate.tier,
      parentAffiliateId: affiliate.parentAffiliateId,
      status: affiliate.status,
      commissionRate: affiliate.commissionRate.toString(),
      payoutMethod: affiliate.payoutMethod,
      payoutDetails: affiliate.payoutDetails,
      createdAt: affiliate.createdAt.toISOString(),
      updatedAt: affiliate.updatedAt.toISOString(),
    };
  }
}
