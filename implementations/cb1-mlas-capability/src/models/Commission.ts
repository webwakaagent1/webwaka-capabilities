/**
 * Commission Model
 * 
 * Represents a commission calculation in the MLAS system. Commissions are
 * calculated based on sales and affiliate commission rules, and can be
 * approved, disputed, or paid out.
 */

import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { CommissionCalculation, CommissionStatus } from '../types';

export class CommissionModel {
  /**
   * Create a new commission calculation
   */
  static create(
    tenantId: string,
    saleId: string,
    affiliateId: string,
    affiliateChain: string[],
    commissionRuleId: string,
    grossAmount: Decimal | number,
    commissionAmount: Decimal | number,
    commissionRate: Decimal | number,
  ): CommissionCalculation {
    const gross = new Decimal(grossAmount);
    const commission = new Decimal(commissionAmount);
    const net = gross.minus(commission);

    return {
      id: uuidv4(),
      tenantId,
      saleId,
      affiliateId,
      affiliateChain,
      commissionRuleId,
      grossAmount: gross,
      commissionAmount: commission,
      commissionRate: new Decimal(commissionRate),
      netAmount: net,
      status: CommissionStatus.PENDING,
      calculatedAt: new Date(),
    };
  }

  /**
   * Validate commission data
   */
  static validate(commission: CommissionCalculation): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!commission.saleId) {
      errors.push('Sale ID is required');
    }

    if (!commission.affiliateId) {
      errors.push('Affiliate ID is required');
    }

    if (commission.grossAmount.isNegative()) {
      errors.push('Gross amount cannot be negative');
    }

    if (commission.commissionAmount.isNegative()) {
      errors.push('Commission amount cannot be negative');
    }

    if (commission.commissionAmount.greaterThan(commission.grossAmount)) {
      errors.push('Commission amount cannot exceed gross amount');
    }

    if (commission.commissionRate.isNegative() || commission.commissionRate.greaterThan(100)) {
      errors.push('Commission rate must be between 0 and 100');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Update commission status
   */
  static updateStatus(commission: CommissionCalculation, newStatus: CommissionStatus): CommissionCalculation {
    return {
      ...commission,
      status: newStatus,
      paidAt: newStatus === CommissionStatus.PAID ? new Date() : commission.paidAt,
    };
  }

  /**
   * Approve commission
   */
  static approve(commission: CommissionCalculation): CommissionCalculation {
    if (commission.status !== CommissionStatus.CALCULATED) {
      throw new Error(`Cannot approve commission in ${commission.status} status`);
    }
    return CommissionModel.updateStatus(commission, CommissionStatus.APPROVED);
  }

  /**
   * Mark commission as paid
   */
  static markAsPaid(commission: CommissionCalculation): CommissionCalculation {
    if (commission.status !== CommissionStatus.APPROVED) {
      throw new Error(`Cannot mark commission as paid in ${commission.status} status`);
    }
    return CommissionModel.updateStatus(commission, CommissionStatus.PAID);
  }

  /**
   * Dispute commission
   */
  static dispute(commission: CommissionCalculation): CommissionCalculation {
    if (commission.status === CommissionStatus.PAID) {
      throw new Error('Cannot dispute a paid commission');
    }
    return CommissionModel.updateStatus(commission, CommissionStatus.DISPUTED);
  }

  /**
   * Calculate commission from sale amount and rate
   */
  static calculateAmount(saleAmount: Decimal | number, commissionRate: Decimal | number): Decimal {
    const sale = new Decimal(saleAmount);
    const rate = new Decimal(commissionRate);
    return sale.times(rate).dividedBy(100);
  }

  /**
   * Check if commission can be modified
   */
  static canModify(commission: CommissionCalculation): boolean {
    return commission.status === CommissionStatus.PENDING || commission.status === CommissionStatus.CALCULATED;
  }

  /**
   * Serialize commission to JSON
   */
  static toJSON(commission: CommissionCalculation): Record<string, unknown> {
    return {
      id: commission.id,
      tenantId: commission.tenantId,
      saleId: commission.saleId,
      affiliateId: commission.affiliateId,
      affiliateChain: commission.affiliateChain,
      commissionRuleId: commission.commissionRuleId,
      grossAmount: commission.grossAmount.toString(),
      commissionAmount: commission.commissionAmount.toString(),
      commissionRate: commission.commissionRate.toString(),
      netAmount: commission.netAmount.toString(),
      status: commission.status,
      calculatedAt: commission.calculatedAt.toISOString(),
      paidAt: commission.paidAt?.toISOString(),
    };
  }
}
