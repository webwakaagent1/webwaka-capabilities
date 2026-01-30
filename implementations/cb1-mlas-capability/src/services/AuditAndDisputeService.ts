/**
 * Audit and Dispute Service
 * 
 * Handles audit logging for all MLAS transactions and dispute resolution.
 * Maintains immutable audit trail and provides dispute resolution workflows.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  MLASTransaction,
  TransactionType,
  TransactionStatus,
  Dispute,
  DisputeStatus,
  DisputeReason,
  DisputeResolution,
  ResolutionType,
  IAuditService,
  IDisputeService,
  Actor,
  TransactionResource,
} from '../types';

export class AuditService implements IAuditService {
  private transactions: Map<string, MLASTransaction> = new Map();

  /**
   * Log a transaction to the audit trail
   * 
   * @param transaction - The transaction to log
   */
  async logTransaction(transaction: MLASTransaction): Promise<void> {
    // Ensure immutability by creating a copy
    const immutableTransaction: MLASTransaction = {
      ...transaction,
      id: transaction.id || uuidv4(),
      createdAt: new Date(),
      changes: { ...transaction.changes },
    };

    this.transactions.set(immutableTransaction.id, immutableTransaction);
  }

  /**
   * Get transaction history with optional filters
   * 
   * @param tenantId - The tenant ID
   * @param filters - Optional filters
   * @returns Array of transactions
   */
  async getTransactionHistory(
    tenantId: string,
    filters?: Record<string, unknown>,
  ): Promise<MLASTransaction[]> {
    let transactions = Array.from(this.transactions.values()).filter(
      (t) => t.tenantId === tenantId,
    );

    if (filters) {
      if (filters.transactionType) {
        transactions = transactions.filter(
          (t) => t.transactionType === filters.transactionType,
        );
      }

      if (filters.status) {
        transactions = transactions.filter(
          (t) => t.status === filters.status,
        );
      }

      if (filters.actor) {
        transactions = transactions.filter(
          (t) => t.actor.id === filters.actor,
        );
      }

      if (filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate as string);
        const end = new Date(filters.endDate as string);
        transactions = transactions.filter(
          (t) => t.createdAt >= start && t.createdAt <= end,
        );
      }
    }

    return transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get transaction history for an affiliate
   * 
   * @param affiliateId - The affiliate ID
   * @returns Array of transactions
   */
  async getAffiliateHistory(affiliateId: string): Promise<MLASTransaction[]> {
    return Array.from(this.transactions.values())
      .filter((t) => t.resource.id === affiliateId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Create an audit transaction
   */
  createTransaction(
    tenantId: string,
    transactionType: TransactionType,
    actor: Actor,
    resource: TransactionResource,
    changes: Record<string, unknown>,
    status: TransactionStatus,
    ipAddress: string,
    userAgent: string,
  ): MLASTransaction {
    return {
      id: uuidv4(),
      tenantId,
      transactionType,
      actor,
      resource,
      changes,
      status,
      ipAddress,
      userAgent,
      createdAt: new Date(),
    };
  }

  /**
   * Validate transaction
   */
  validateTransaction(transaction: MLASTransaction): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!transaction.tenantId) {
      errors.push('Tenant ID is required');
    }

    if (!transaction.actor || !transaction.actor.id) {
      errors.push('Actor is required');
    }

    if (!transaction.resource || !transaction.resource.id) {
      errors.push('Resource is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serialize transaction to JSON
   */
  toJSON(transaction: MLASTransaction): Record<string, unknown> {
    return {
      id: transaction.id,
      tenantId: transaction.tenantId,
      transactionType: transaction.transactionType,
      actor: transaction.actor,
      resource: transaction.resource,
      changes: transaction.changes,
      status: transaction.status,
      ipAddress: transaction.ipAddress,
      userAgent: transaction.userAgent,
      createdAt: transaction.createdAt.toISOString(),
    };
  }
}

/**
 * Dispute Service
 */
export class DisputeService implements IDisputeService {
  private disputes: Map<string, Dispute> = new Map();

  /**
   * Create a dispute
   * 
   * @param commissionId - The commission ID
   * @param affiliateId - The affiliate ID
   * @param reason - The dispute reason
   * @param description - The dispute description
   * @returns The created dispute
   */
  async createDispute(
    commissionId: string,
    affiliateId: string,
    reason: DisputeReason,
    description: string,
  ): Promise<Dispute> {
    const dispute: Dispute = {
      id: uuidv4(),
      tenantId: '', // Will be set by service layer
      commissionId,
      affiliateId,
      reason,
      description,
      status: DisputeStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.disputes.set(dispute.id, dispute);
    return dispute;
  }

  /**
   * Resolve a dispute
   * 
   * @param disputeId - The dispute ID
   * @param resolution - The resolution details
   */
  async resolveDispute(disputeId: string, resolution: DisputeResolution): Promise<void> {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) {
      throw new Error(`Dispute ${disputeId} not found`);
    }

    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolution = resolution;
    dispute.resolvedAt = new Date();
    dispute.updatedAt = new Date();
  }

  /**
   * Get disputes for an affiliate
   * 
   * @param affiliateId - The affiliate ID
   * @returns Array of disputes
   */
  async getDisputesByAffiliate(affiliateId: string): Promise<Dispute[]> {
    return Array.from(this.disputes.values()).filter(
      (d) => d.affiliateId === affiliateId,
    );
  }

  /**
   * Get open disputes for a tenant
   * 
   * @param tenantId - The tenant ID
   * @returns Array of open disputes
   */
  async getOpenDisputes(tenantId: string): Promise<Dispute[]> {
    return Array.from(this.disputes.values()).filter(
      (d) => d.tenantId === tenantId && d.status === DisputeStatus.OPEN,
    );
  }

  /**
   * Validate dispute
   */
  validateDispute(dispute: Dispute): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!dispute.commissionId) {
      errors.push('Commission ID is required');
    }

    if (!dispute.affiliateId) {
      errors.push('Affiliate ID is required');
    }

    if (!dispute.reason) {
      errors.push('Dispute reason is required');
    }

    if (!dispute.description || dispute.description.trim().length === 0) {
      errors.push('Dispute description is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serialize dispute to JSON
   */
  toJSON(dispute: Dispute): Record<string, unknown> {
    return {
      id: dispute.id,
      tenantId: dispute.tenantId,
      commissionId: dispute.commissionId,
      affiliateId: dispute.affiliateId,
      reason: dispute.reason,
      description: dispute.description,
      status: dispute.status,
      evidence: dispute.evidence,
      resolution: dispute.resolution,
      createdAt: dispute.createdAt.toISOString(),
      updatedAt: dispute.updatedAt.toISOString(),
      resolvedAt: dispute.resolvedAt?.toISOString(),
    };
  }
}
