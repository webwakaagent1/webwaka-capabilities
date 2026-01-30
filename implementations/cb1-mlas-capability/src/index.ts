/**
 * CB-1 MLAS Capability - Main Entry Point
 * 
 * Exports all services, models, and types for the Multi-Level Affiliate System.
 */

// Export types
export * from './types';

// Export models
export { AffiliateModel } from './models/Affiliate';
export { CommissionModel } from './models/Commission';

// Export services
export { AttributionService } from './services/AttributionService';
export { CommissionCalculationService } from './services/CommissionCalculationService';
export { PayoutService } from './services/PayoutService';
export { AuditService, DisputeService } from './services/AuditAndDisputeService';

/**
 * MLAS Module initialization
 */
export class MLASModule {
  private attributionService: any;
  private commissionService: any;
  private payoutService: any;
  private auditService: any;
  private disputeService: any;

  constructor() {
    this.attributionService = new (require('./services/AttributionService').AttributionService)();
    this.commissionService = new (require('./services/CommissionCalculationService').CommissionCalculationService)();
    this.payoutService = new (require('./services/PayoutService').PayoutService)();
    this.auditService = new (require('./services/AuditAndDisputeService').AuditService)();
    this.disputeService = new (require('./services/AuditAndDisputeService').DisputeService)();
  }

  getAttributionService() {
    return this.attributionService;
  }

  getCommissionService() {
    return this.commissionService;
  }

  getPayoutService() {
    return this.payoutService;
  }

  getAuditService() {
    return this.auditService;
  }

  getDisputeService() {
    return this.disputeService;
  }
}

export default MLASModule;
