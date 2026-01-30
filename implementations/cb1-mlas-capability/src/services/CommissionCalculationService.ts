/**
 * Commission Calculation Service
 * 
 * Handles commission calculation based on configurable rules. Supports
 * multiple commission models including flat rate, percentage, tiered,
 * and performance-based commissions.
 */

import Decimal from 'decimal.js';
import {
  CommissionCalculation,
  CommissionRule,
  CommissionRuleType,
  CommissionCondition,
  CommissionStatus,
  ICommissionService,
  DisputeReason,
  Dispute,
  DisputeStatus,
} from '../types';
import { CommissionModel } from '../models/Commission';
import { v4 as uuidv4 } from 'uuid';

export class CommissionCalculationService implements ICommissionService {
  private commissions: Map<string, CommissionCalculation> = new Map();
  private disputes: Map<string, Dispute> = new Map();

  /**
   * Calculate commissions for a sale across the affiliate chain
   * 
   * @param saleId - The ID of the sale
   * @param saleAmount - The total sale amount
   * @param affiliateChain - The chain of affiliates from direct to root
   * @param rules - Commission rules to apply
   * @returns Array of commission calculations for each affiliate in chain
   */
  async calculateCommission(
    saleId: string,
    saleAmount: Decimal | number,
    affiliateChain: string[],
    rules?: CommissionRule[],
  ): Promise<CommissionCalculation[]> {
    const amount = new Decimal(saleAmount);
    const commissions: CommissionCalculation[] = [];

    // Calculate commission for each affiliate in the chain
    for (let i = 0; i < affiliateChain.length; i++) {
      const affiliateId = affiliateChain[i];
      
      // Find applicable rule for this affiliate
      const applicableRule = rules?.[0]; // Simplified: use first rule
      if (!applicableRule) {
        continue;
      }

      // Calculate commission amount
      const commissionAmount = this.calculateCommissionAmount(
        amount,
        applicableRule,
        i,
      );

      // Create commission record
      const commission = CommissionModel.create(
        '', // tenantId will be set by service layer
        saleId,
        affiliateId,
        affiliateChain,
        applicableRule.id,
        amount,
        commissionAmount,
        applicableRule.commissionStructure.baseRate,
      );

      commission.status = CommissionStatus.CALCULATED;
      this.commissions.set(commission.id, commission);
      commissions.push(commission);
    }

    return commissions;
  }

  /**
   * Calculate commission amount based on rule and affiliate tier
   * 
   * @param saleAmount - The sale amount
   * @param rule - The commission rule
   * @param tierPosition - Position in the affiliate chain (0 = direct)
   * @returns The commission amount
   */
  private calculateCommissionAmount(
    saleAmount: Decimal,
    rule: CommissionRule,
    tierPosition: number,
  ): Decimal {
    const baseRate = rule.commissionStructure.baseRate;
    
    // Apply tier-based reduction (sub-affiliates get lower commission)
    const tierMultiplier = new Decimal(1).minus(new Decimal(tierPosition).times(0.1));
    const adjustedRate = baseRate.times(tierMultiplier);

    // Calculate base commission
    let commission = saleAmount.times(adjustedRate).dividedBy(100);

    // Apply bonus rates if applicable
    if (rule.commissionStructure.bonusRates) {
      for (const bonus of rule.commissionStructure.bonusRates) {
        if (saleAmount.greaterThanOrEqualTo(bonus.threshold)) {
          commission = saleAmount.times(bonus.rate).dividedBy(100);
        }
      }
    }

    // Apply cap if set
    if (rule.commissionStructure.capAmount && commission.greaterThan(rule.commissionStructure.capAmount)) {
      commission = rule.commissionStructure.capAmount;
    }

    // Apply minimum if set
    if (rule.commissionStructure.minAmount && commission.lessThan(rule.commissionStructure.minAmount)) {
      commission = rule.commissionStructure.minAmount;
    }

    return commission;
  }

  /**
   * Check if a commission rule applies based on conditions
   * 
   * @param rule - The commission rule
   * @param saleData - The sale data to check against
   * @returns True if rule applies
   */
  private ruleApplies(rule: CommissionRule, saleData: Record<string, unknown>): boolean {
    if (!rule.conditions || rule.conditions.length === 0) {
      return true;
    }

    return rule.conditions.every((condition) => this.conditionMet(condition, saleData));
  }

  /**
   * Check if a condition is met
   * 
   * @param condition - The condition to check
   * @param data - The data to check against
   * @returns True if condition is met
   */
  private conditionMet(condition: CommissionCondition, data: Record<string, unknown>): boolean {
    const value = data[condition.field];

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'gte':
        return Number(value) >= Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'lte':
        return Number(value) <= Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'contains':
        return String(value).includes(String(condition.value));
      default:
        return false;
    }
  }

  /**
   * Get commissions for an affiliate
   * 
   * @param affiliateId - The affiliate ID
   * @returns Array of commissions for the affiliate
   */
  async getCommissionsByAffiliate(affiliateId: string): Promise<CommissionCalculation[]> {
    return Array.from(this.commissions.values()).filter(
      (comm) => comm.affiliateId === affiliateId,
    );
  }

  /**
   * Approve a commission
   * 
   * @param commissionId - The commission ID
   */
  async approveCommission(commissionId: string): Promise<void> {
    const commission = this.commissions.get(commissionId);
    if (!commission) {
      throw new Error(`Commission ${commissionId} not found`);
    }

    const approved = CommissionModel.approve(commission);
    this.commissions.set(commissionId, approved);
  }

  /**
   * Dispute a commission
   * 
   * @param commissionId - The commission ID
   * @param reason - The dispute reason
   * @param description - The dispute description
   * @returns The created dispute
   */
  async disputeCommission(
    commissionId: string,
    reason: DisputeReason,
    description: string,
  ): Promise<Dispute> {
    const commission = this.commissions.get(commissionId);
    if (!commission) {
      throw new Error(`Commission ${commissionId} not found`);
    }

    const dispute: Dispute = {
      id: uuidv4(),
      tenantId: commission.tenantId,
      commissionId,
      affiliateId: commission.affiliateId,
      reason,
      description,
      status: DisputeStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.disputes.set(dispute.id, dispute);

    // Update commission status
    const disputed = CommissionModel.dispute(commission);
    this.commissions.set(commissionId, disputed);

    return dispute;
  }

  /**
   * Validate commission data
   */
  validateCommission(commission: CommissionCalculation): { valid: boolean; errors: string[] } {
    return CommissionModel.validate(commission);
  }

  /**
   * Serialize commission to JSON
   */
  toJSON(commission: CommissionCalculation): Record<string, unknown> {
    return CommissionModel.toJSON(commission);
  }
}
