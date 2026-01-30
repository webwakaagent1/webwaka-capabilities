/**
 * Attribution Service
 * 
 * Handles attribution tracking for sales to affiliates. Supports multiple
 * attribution models including direct, referral, and multi-touch attribution.
 * Maintains the affiliate chain for multi-level commission calculations.
 */

import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import {
  Attribution,
  AttributionType,
  IAttributionService,
} from '../types';

export class AttributionService implements IAttributionService {
  private attributions: Map<string, Attribution> = new Map();

  /**
   * Track attribution for a sale to an affiliate
   * 
   * @param saleId - The ID of the sale
   * @param affiliateId - The ID of the affiliate making the sale
   * @param affiliateChain - The chain of affiliates from direct to root
   * @param attributionType - The type of attribution
   * @returns The created attribution record
   */
  async trackAttribution(
    saleId: string,
    affiliateId: string,
    affiliateChain: string[],
    attributionType: AttributionType,
  ): Promise<Attribution> {
    // Validate input
    if (!saleId || !affiliateId || !affiliateChain || affiliateChain.length === 0) {
      throw new Error('Invalid attribution parameters');
    }

    // Ensure affiliate is in the chain
    if (!affiliateChain.includes(affiliateId)) {
      affiliateChain = [affiliateId, ...affiliateChain];
    }

    const attribution: Attribution = {
      id: uuidv4(),
      tenantId: '', // Will be set by service layer
      saleId,
      affiliateId,
      affiliateChain,
      attributionType,
      attributionWeight: new Decimal(1),
      createdAt: new Date(),
    };

    this.attributions.set(attribution.id, attribution);
    return attribution;
  }

  /**
   * Get all attributions for a sale
   * 
   * @param saleId - The ID of the sale
   * @returns Array of attributions for the sale
   */
  async getAttributionBySale(saleId: string): Promise<Attribution[]> {
    return Array.from(this.attributions.values()).filter(
      (attr) => attr.saleId === saleId,
    );
  }

  /**
   * Get all attributions for an affiliate
   * 
   * @param affiliateId - The ID of the affiliate
   * @returns Array of attributions for the affiliate
   */
  async getAttributionsByAffiliate(affiliateId: string): Promise<Attribution[]> {
    return Array.from(this.attributions.values()).filter(
      (attr) => attr.affiliateChain.includes(affiliateId),
    );
  }

  /**
   * Calculate attribution weight for multi-touch attribution
   * 
   * Distributes credit across multiple touchpoints based on position in chain.
   * Closer to the sale (earlier in chain) gets higher weight.
   * 
   * @param chainLength - Length of the affiliate chain
   * @param position - Position in the chain (0 = direct affiliate)
   * @returns The weight for this position
   */
  calculateAttributionWeight(chainLength: number, position: number): Decimal {
    if (chainLength === 1) {
      return new Decimal(1);
    }

    // Linear decay: first position gets most weight
    const weight = new Decimal(chainLength - position).dividedBy(
      new Decimal(chainLength * (chainLength + 1) / 2),
    );
    return weight;
  }

  /**
   * Get attribution chain for multi-level commission calculation
   * 
   * @param affiliateId - The ID of the affiliate
   * @param attributions - Array of attributions to search
   * @returns The affiliate chain
   */
  getAffiliateChain(affiliateId: string, attributions: Attribution[]): string[] {
    const attribution = attributions.find((attr) => attr.affiliateId === affiliateId);
    return attribution?.affiliateChain || [affiliateId];
  }

  /**
   * Validate attribution data
   * 
   * @param attribution - The attribution to validate
   * @returns Validation result
   */
  validateAttribution(attribution: Attribution): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!attribution.saleId) {
      errors.push('Sale ID is required');
    }

    if (!attribution.affiliateId) {
      errors.push('Affiliate ID is required');
    }

    if (!attribution.affiliateChain || attribution.affiliateChain.length === 0) {
      errors.push('Affiliate chain is required');
    }

    if (!attribution.affiliateChain.includes(attribution.affiliateId)) {
      errors.push('Affiliate must be in the affiliate chain');
    }

    if (attribution.attributionWeight.isNegative() || attribution.attributionWeight.greaterThan(1)) {
      errors.push('Attribution weight must be between 0 and 1');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serialize attribution to JSON
   */
  toJSON(attribution: Attribution): Record<string, unknown> {
    return {
      id: attribution.id,
      tenantId: attribution.tenantId,
      saleId: attribution.saleId,
      affiliateId: attribution.affiliateId,
      affiliateChain: attribution.affiliateChain,
      attributionType: attribution.attributionType,
      attributionWeight: attribution.attributionWeight.toString(),
      createdAt: attribution.createdAt.toISOString(),
    };
  }
}
