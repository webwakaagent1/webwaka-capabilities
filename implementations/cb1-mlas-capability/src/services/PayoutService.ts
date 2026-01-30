/**
 * Payout Service
 * 
 * Handles payout scheduling and processing. Manages payout batches,
 * individual payouts, and retry logic for failed payouts.
 */

import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import {
  PayoutBatch,
  Payout,
  PayoutStatus,
  CommissionCalculation,
} from '../types';

export class PayoutService {
  private batches: Map<string, PayoutBatch> = new Map();
  private payouts: Map<string, Payout> = new Map();
  private batchCounter: number = 0;

  /**
   * Schedule a payout batch for commissions
   * 
   * @param commissions - The commissions to payout
   * @param scheduledDate - When to process the payout
   * @returns The created payout batch
   */
  async schedulePayout(
    commissions: CommissionCalculation[],
    scheduledDate: Date,
  ): Promise<PayoutBatch> {
    if (!commissions || commissions.length === 0) {
      throw new Error('At least one commission is required');
    }

    // Calculate total amount
    const totalAmount = commissions.reduce(
      (sum, comm) => sum.plus(comm.commissionAmount),
      new Decimal(0),
    );

    // Create batch
    const batch: PayoutBatch = {
      id: uuidv4(),
      tenantId: commissions[0].tenantId,
      batchNumber: `BATCH-${++this.batchCounter}`,
      commissionIds: commissions.map((c) => c.id),
      totalAmount,
      status: PayoutStatus.SCHEDULED,
      scheduledDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.batches.set(batch.id, batch);

    // Create individual payouts
    for (const commission of commissions) {
      const payout: Payout = {
        id: uuidv4(),
        tenantId: commission.tenantId,
        batchId: batch.id,
        affiliateId: commission.affiliateId,
        amount: commission.commissionAmount,
        payoutMethod: undefined as any, // Will be set by service layer
        status: PayoutStatus.SCHEDULED,
        createdAt: new Date(),
      };

      this.payouts.set(payout.id, payout);
    }

    return batch;
  }

  /**
   * Process a payout batch
   * 
   * @param batchId - The batch ID to process
   */
  async processPayout(batchId: string): Promise<void> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    if (batch.status !== PayoutStatus.SCHEDULED) {
      throw new Error(`Cannot process batch in ${batch.status} status`);
    }

    // Update batch status
    batch.status = PayoutStatus.PROCESSING;
    batch.updatedAt = new Date();

    try {
      // Process each payout
      for (const commissionId of batch.commissionIds) {
        const payouts = Array.from(this.payouts.values()).filter(
          (p) => p.batchId === batchId,
        );

        for (const payout of payouts) {
          // Simulate payout processing
          payout.status = PayoutStatus.COMPLETED;
          payout.transactionId = `TXN-${uuidv4()}`;
          payout.processedAt = new Date();
        }
      }

      // Mark batch as completed
      batch.status = PayoutStatus.COMPLETED;
      batch.processedDate = new Date();
    } catch (error) {
      batch.status = PayoutStatus.FAILED;
      batch.failureReason = (error as Error).message;
    }

    batch.updatedAt = new Date();
  }

  /**
   * Get payouts for an affiliate
   * 
   * @param affiliateId - The affiliate ID
   * @returns Array of payouts for the affiliate
   */
  async getPayoutsByAffiliate(affiliateId: string): Promise<Payout[]> {
    return Array.from(this.payouts.values()).filter(
      (payout) => payout.affiliateId === affiliateId,
    );
  }

  /**
   * Retry a failed payout
   * 
   * @param payoutId - The payout ID
   */
  async retryFailedPayout(payoutId: string): Promise<void> {
    const payout = this.payouts.get(payoutId);
    if (!payout) {
      throw new Error(`Payout ${payoutId} not found`);
    }

    if (payout.status !== PayoutStatus.FAILED) {
      throw new Error(`Cannot retry payout in ${payout.status} status`);
    }

    // Reset payout for retry
    payout.status = PayoutStatus.SCHEDULED;
    payout.failureReason = undefined;
    payout.transactionId = undefined;
    payout.processedAt = undefined;
  }

  /**
   * Get batch statistics
   * 
   * @param batchId - The batch ID
   * @returns Batch statistics
   */
  async getBatchStats(batchId: string): Promise<Record<string, unknown>> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const payouts = Array.from(this.payouts.values()).filter(
      (p) => p.batchId === batchId,
    );

    const completed = payouts.filter((p) => p.status === PayoutStatus.COMPLETED).length;
    const failed = payouts.filter((p) => p.status === PayoutStatus.FAILED).length;
    const pending = payouts.filter((p) => p.status === PayoutStatus.SCHEDULED).length;

    const completedAmount = payouts
      .filter((p) => p.status === PayoutStatus.COMPLETED)
      .reduce((sum, p) => sum.plus(p.amount), new Decimal(0));

    return {
      batchId,
      batchNumber: batch.batchNumber,
      totalPayouts: payouts.length,
      completedPayouts: completed,
      failedPayouts: failed,
      pendingPayouts: pending,
      totalAmount: batch.totalAmount.toString(),
      completedAmount: completedAmount.toString(),
      successRate: payouts.length > 0 ? (completed / payouts.length * 100).toFixed(2) : '0',
      status: batch.status,
    };
  }

  /**
   * Validate payout batch
   */
  validateBatch(batch: PayoutBatch): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!batch.commissionIds || batch.commissionIds.length === 0) {
      errors.push('At least one commission is required');
    }

    if (batch.totalAmount.isNegative()) {
      errors.push('Total amount cannot be negative');
    }

    if (batch.scheduledDate < new Date()) {
      errors.push('Scheduled date must be in the future');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serialize payout to JSON
   */
  toJSON(payout: Payout): Record<string, unknown> {
    return {
      id: payout.id,
      tenantId: payout.tenantId,
      batchId: payout.batchId,
      affiliateId: payout.affiliateId,
      amount: payout.amount.toString(),
      payoutMethod: payout.payoutMethod,
      status: payout.status,
      transactionId: payout.transactionId,
      failureReason: payout.failureReason,
      processedAt: payout.processedAt?.toISOString(),
      createdAt: payout.createdAt.toISOString(),
    };
  }
}
