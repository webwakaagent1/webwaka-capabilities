/**
 * CB-1 MLAS Capability - Core Type Definitions
 * 
 * Defines all TypeScript interfaces and types for the Multi-Level Affiliate System.
 * These types ensure type safety across all MLAS services and operations.
 */

import Decimal from 'decimal.js';

// ============================================================================
// ACTOR & ORGANIZATION TYPES
// ============================================================================

/**
 * Actor types in the MLAS system
 */
export enum ActorType {
  PLATFORM = 'PLATFORM',
  PARTNER = 'PARTNER',
  CLIENT = 'CLIENT',
  AFFILIATE = 'AFFILIATE',
}

/**
 * Organization representation in MLAS
 */
export interface Organization {
  id: string;
  tenantId: string;
  name: string;
  type: ActorType;
  parentId?: string; // For hierarchical structures
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// REVENUE MODEL TYPES
// ============================================================================

/**
 * Revenue model types supported by MLAS
 */
export enum RevenueModel {
  PLATFORM_FIRST = 'PLATFORM_FIRST',           // Platform takes cut first
  PARTNER_OWNED = 'PARTNER_OWNED',             // Partner owns revenue, pays platform
  CLIENT_OWNED = 'CLIENT_OWNED',               // Client owns revenue, pays platform
  ZERO_PLATFORM_CUT = 'ZERO_PLATFORM_CUT',     // Platform takes no cut
  HYBRID = 'HYBRID',                           // Combination of models
}

/**
 * Revenue model configuration
 */
export interface RevenueModelConfig {
  id: string;
  tenantId: string;
  model: RevenueModel;
  platformCutPercentage: Decimal;
  partnerCutPercentage: Decimal;
  clientCutPercentage: Decimal;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// AFFILIATE & ATTRIBUTION TYPES
// ============================================================================

/**
 * Affiliate representation
 */
export interface Affiliate {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  email: string;
  tier: number; // 1 = direct affiliate, 2+ = sub-affiliates
  parentAffiliateId?: string;
  status: AffiliateStatus;
  commissionRate: Decimal;
  payoutMethod: PayoutMethod;
  payoutDetails: PayoutDetails;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Affiliate status
 */
export enum AffiliateStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
}

/**
 * Attribution record for tracking sales to affiliates
 */
export interface Attribution {
  id: string;
  tenantId: string;
  saleId: string;
  affiliateId: string;
  affiliateChain: string[]; // Array of affiliate IDs from direct to root
  attributionType: AttributionType;
  attributionWeight: Decimal; // For multi-touch attribution
  createdAt: Date;
}

/**
 * Attribution types
 */
export enum AttributionType {
  DIRECT = 'DIRECT',
  REFERRAL = 'REFERRAL',
  MULTI_TOUCH = 'MULTI_TOUCH',
  FIRST_TOUCH = 'FIRST_TOUCH',
  LAST_TOUCH = 'LAST_TOUCH',
}

// ============================================================================
// COMMISSION TYPES
// ============================================================================

/**
 * Commission calculation rule
 */
export interface CommissionRule {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  description: string;
  ruleType: CommissionRuleType;
  conditions: CommissionCondition[];
  commissionStructure: CommissionStructure;
  isActive: boolean;
  priority: number; // Higher priority rules evaluated first
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Commission rule types
 */
export enum CommissionRuleType {
  FLAT_RATE = 'FLAT_RATE',
  PERCENTAGE = 'PERCENTAGE',
  TIERED = 'TIERED',
  PERFORMANCE_BASED = 'PERFORMANCE_BASED',
  HYBRID = 'HYBRID',
}

/**
 * Condition for applying a commission rule
 */
export interface CommissionCondition {
  field: string; // e.g., 'saleAmount', 'productCategory', 'affiliateTier'
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: string | number | string[] | number[];
}

/**
 * Commission structure
 */
export interface CommissionStructure {
  baseRate: Decimal;
  bonusRates?: TieredRate[];
  capAmount?: Decimal;
  minAmount?: Decimal;
}

/**
 * Tiered commission rate
 */
export interface TieredRate {
  threshold: Decimal;
  rate: Decimal;
  description?: string;
}

/**
 * Commission calculation result
 */
export interface CommissionCalculation {
  id: string;
  tenantId: string;
  saleId: string;
  affiliateId: string;
  affiliateChain: string[];
  commissionRuleId: string;
  grossAmount: Decimal;
  commissionAmount: Decimal;
  commissionRate: Decimal;
  netAmount: Decimal;
  status: CommissionStatus;
  calculatedAt: Date;
  paidAt?: Date;
}

/**
 * Commission status
 */
export enum CommissionStatus {
  PENDING = 'PENDING',
  CALCULATED = 'CALCULATED',
  APPROVED = 'APPROVED',
  DISPUTED = 'DISPUTED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

// ============================================================================
// PAYOUT TYPES
// ============================================================================

/**
 * Payout method
 */
export enum PayoutMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  PAYPAL = 'PAYPAL',
  STRIPE = 'STRIPE',
  CRYPTO = 'CRYPTO',
  INTERNAL_CREDIT = 'INTERNAL_CREDIT',
}

/**
 * Payout details
 */
export interface PayoutDetails {
  method: PayoutMethod;
  accountNumber?: string;
  routingNumber?: string;
  bankName?: string;
  accountHolderName?: string;
  paypalEmail?: string;
  stripeAccountId?: string;
  cryptoAddress?: string;
  cryptoCurrency?: string;
}

/**
 * Payout batch
 */
export interface PayoutBatch {
  id: string;
  tenantId: string;
  batchNumber: string;
  commissionIds: string[];
  totalAmount: Decimal;
  status: PayoutStatus;
  scheduledDate: Date;
  processedDate?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payout status
 */
export enum PayoutStatus {
  SCHEDULED = 'SCHEDULED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Individual payout
 */
export interface Payout {
  id: string;
  tenantId: string;
  batchId: string;
  affiliateId: string;
  amount: Decimal;
  payoutMethod: PayoutMethod;
  status: PayoutStatus;
  transactionId?: string;
  failureReason?: string;
  processedAt?: Date;
  createdAt: Date;
}

// ============================================================================
// DISPUTE & RESOLUTION TYPES
// ============================================================================

/**
 * Dispute record
 */
export interface Dispute {
  id: string;
  tenantId: string;
  commissionId: string;
  affiliateId: string;
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  evidence?: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolution?: DisputeResolution;
}

/**
 * Dispute reason
 */
export enum DisputeReason {
  INCORRECT_CALCULATION = 'INCORRECT_CALCULATION',
  DUPLICATE_COMMISSION = 'DUPLICATE_COMMISSION',
  UNAUTHORIZED_CHARGE = 'UNAUTHORIZED_CHARGE',
  QUALITY_ISSUE = 'QUALITY_ISSUE',
  OTHER = 'OTHER',
}

/**
 * Dispute status
 */
export enum DisputeStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
  APPEALED = 'APPEALED',
  CLOSED = 'CLOSED',
}

/**
 * Dispute resolution
 */
export interface DisputeResolution {
  resolutionType: ResolutionType;
  adjustmentAmount: Decimal;
  notes: string;
  resolvedBy: string;
}

/**
 * Resolution type
 */
export enum ResolutionType {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PARTIAL_APPROVAL = 'PARTIAL_APPROVAL',
  REFUND = 'REFUND',
}

// ============================================================================
// AUDIT & TRANSACTION TYPES
// ============================================================================

/**
 * MLAS transaction for audit trail
 */
export interface MLASTransaction {
  id: string;
  tenantId: string;
  transactionType: TransactionType;
  actor: Actor;
  resource: TransactionResource;
  changes: Record<string, unknown>;
  status: TransactionStatus;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

/**
 * Transaction type
 */
export enum TransactionType {
  ATTRIBUTION_CREATED = 'ATTRIBUTION_CREATED',
  COMMISSION_CALCULATED = 'COMMISSION_CALCULATED',
  COMMISSION_APPROVED = 'COMMISSION_APPROVED',
  COMMISSION_DISPUTED = 'COMMISSION_DISPUTED',
  PAYOUT_SCHEDULED = 'PAYOUT_SCHEDULED',
  PAYOUT_PROCESSED = 'PAYOUT_PROCESSED',
  DISPUTE_CREATED = 'DISPUTE_CREATED',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
  AFFILIATE_CREATED = 'AFFILIATE_CREATED',
  AFFILIATE_UPDATED = 'AFFILIATE_UPDATED',
  RULE_CREATED = 'RULE_CREATED',
  RULE_UPDATED = 'RULE_UPDATED',
}

/**
 * Actor in transaction
 */
export interface Actor {
  id: string;
  type: ActorType;
  name: string;
}

/**
 * Transaction resource
 */
export interface TransactionResource {
  type: string;
  id: string;
  name?: string;
}

/**
 * Transaction status
 */
export enum TransactionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

// ============================================================================
// REVENUE TREE TYPES
// ============================================================================

/**
 * Revenue tree node representing affiliate hierarchy
 */
export interface RevenueTreeNode {
  affiliateId: string;
  parentAffiliateId?: string;
  children: RevenueTreeNode[];
  commissionRate: Decimal;
  totalCommissions: Decimal;
  totalPayouts: Decimal;
}

/**
 * Revenue tree
 */
export interface RevenueTree {
  id: string;
  tenantId: string;
  organizationId: string;
  root: RevenueTreeNode;
  depth: number;
  totalAffiliates: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// REPORT & ANALYTICS TYPES
// ============================================================================

/**
 * MLAS statistics
 */
export interface MLASStatistics {
  totalSales: Decimal;
  totalCommissions: Decimal;
  totalPayouts: Decimal;
  averageCommissionRate: Decimal;
  activeAffiliates: number;
  totalAffiliates: number;
  disputeRate: Decimal;
  payoutSuccessRate: Decimal;
  period: DateRange;
}

/**
 * Date range
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Affiliate performance
 */
export interface AffiliatePerformance {
  affiliateId: string;
  name: string;
  totalSales: Decimal;
  totalCommissions: Decimal;
  totalPayouts: Decimal;
  averageCommissionRate: Decimal;
  conversionRate: Decimal;
  disputeCount: number;
  lastPayoutDate?: Date;
}

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

/**
 * Attribution service interface
 */
export interface IAttributionService {
  trackAttribution(saleId: string, affiliateId: string, affiliateChain: string[], attributionType: AttributionType): Promise<Attribution>;
  getAttributionBySale(saleId: string): Promise<Attribution[]>;
  getAttributionsByAffiliate(affiliateId: string): Promise<Attribution[]>;
}

/**
 * Commission service interface
 */
export interface ICommissionService {
  calculateCommission(saleId: string, saleAmount: Decimal, affiliateChain: string[]): Promise<CommissionCalculation[]>;
  getCommissionsByAffiliate(affiliateId: string): Promise<CommissionCalculation[]>;
  approveCommission(commissionId: string): Promise<void>;
  disputeCommission(commissionId: string, reason: DisputeReason, description: string): Promise<Dispute>;
}

/**
 * Payout service interface
 */
export interface IPayoutService {
  schedulePayout(commissionIds: string[], scheduledDate: Date): Promise<PayoutBatch>;
  processPayout(batchId: string): Promise<void>;
  getPayoutsByAffiliate(affiliateId: string): Promise<Payout[]>;
  retryFailedPayout(payoutId: string): Promise<void>;
}

/**
 * Audit service interface
 */
export interface IAuditService {
  logTransaction(transaction: MLASTransaction): Promise<void>;
  getTransactionHistory(tenantId: string, filters?: Record<string, unknown>): Promise<MLASTransaction[]>;
  getAffiliateHistory(affiliateId: string): Promise<MLASTransaction[]>;
}

/**
 * Dispute service interface
 */
export interface IDisputeService {
  createDispute(commissionId: string, reason: DisputeReason, description: string): Promise<Dispute>;
  resolveDispute(disputeId: string, resolution: DisputeResolution): Promise<void>;
  getDisputesByAffiliate(affiliateId: string): Promise<Dispute[]>;
  getOpenDisputes(tenantId: string): Promise<Dispute[]>;
}
