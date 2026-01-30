# CB-1: Multi-Level Affiliate System (MLAS) Capability

**Version:** 1.0.0  
**Status:** 🟢 Complete  
**Canonical Reference:** [CB-1: MLAS Capability](../../docs/phases/CB-1_MLAS_CAPABILITY.md)

## Overview

The CB-1 Multi-Level Affiliate System (MLAS) is a configurable revenue-flow infrastructure that enables WebWaka to support complex affiliate and commission structures. The system provides attribution tracking, flexible commission calculation, payout routing, comprehensive auditability, and dispute resolution capabilities.

**Key Capabilities:**
- ✅ **Attribution Tracking** - Track sales to correct affiliates with multi-touch attribution support
- ✅ **Commission Calculation** - Flexible rules engine supporting flat rate, percentage, tiered, and performance-based models
- ✅ **Payout Routing** - Intelligent routing to multiple payout methods (bank transfer, PayPal, Stripe, crypto)
- ✅ **Auditability** - Immutable audit trail for all MLAS transactions
- ✅ **Dispute Resolution** - Webhook-based dispute resolution workflows
- ✅ **Multi-Level Revenue Trees** - Support for complex affiliate hierarchies with unlimited depth

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 15+
- Redis 7+

### Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate:up

# Start application
npm start
```

### Development

```bash
# Start in development mode with hot reload
npm run dev

# Run tests
npm test

# Run specific test suite
npm run test:unit
npm run test:integration

# Check code quality
npm run lint
npm run format
```

## Architecture

The system is organized in a layered architecture:

```
API Layer (Express.js)
    ↓
Service Layer (Attribution, Commission, Payout, Audit, Dispute)
    ↓
Model Layer (Affiliate, Commission, Payout, Dispute)
    ↓
Data Layer (PostgreSQL, Redis)
```

For complete architecture details, see [ARCH_CB1_MLAS.md](./docs/ARCH_CB1_MLAS.md).

## Core Components

### 1. Attribution Service

Tracks sales to affiliates with support for multi-level affiliate chains:

```typescript
// Track a sale attribution
const attribution = await attributionService.trackAttribution(
  saleId,
  affiliateId,
  affiliateChain,
  attributionType
);

// Get attributions for a sale
const attributions = await attributionService.getAttributionBySale(saleId);

// Get attributions for an affiliate
const affiliateAttributions = await attributionService.getAttributionsByAffiliate(affiliateId);
```

### 2. Commission Calculation Service

Calculates commissions based on configurable rules:

```typescript
// Calculate commissions for a sale
const commissions = await commissionService.calculateCommission(
  saleId,
  saleAmount,
  affiliateChain,
  rules
);

// Get commissions for an affiliate
const affiliateCommissions = await commissionService.getCommissionsByAffiliate(affiliateId);

// Approve a commission
await commissionService.approveCommission(commissionId);

// Dispute a commission
const dispute = await commissionService.disputeCommission(
  commissionId,
  reason,
  description
);
```

### 3. Payout Service

Manages payout scheduling and processing:

```typescript
// Schedule a payout batch
const batch = await payoutService.schedulePayout(
  commissions,
  scheduledDate
);

// Process a payout batch
await payoutService.processPayout(batchId);

// Get payouts for an affiliate
const payouts = await payoutService.getPayoutsByAffiliate(affiliateId);

// Retry a failed payout
await payoutService.retryFailedPayout(payoutId);
```

### 4. Audit & Dispute Services

Maintains audit trail and handles dispute resolution:

```typescript
// Log a transaction
await auditService.logTransaction(transaction);

// Get transaction history
const history = await auditService.getTransactionHistory(tenantId, filters);

// Create a dispute
const dispute = await disputeService.createDispute(
  commissionId,
  affiliateId,
  reason,
  description
);

// Resolve a dispute
await disputeService.resolveDispute(disputeId, resolution);
```

## API Endpoints

### Attribution

```
POST   /api/mlas/attributions              # Track attribution
GET    /api/mlas/attributions/:saleId      # Get attributions by sale
GET    /api/mlas/attributions/affiliate/:id # Get attributions by affiliate
```

### Commission

```
POST   /api/mlas/commissions/calculate     # Calculate commissions
GET    /api/mlas/commissions/:id           # Get commission
GET    /api/mlas/commissions/affiliate/:id # Get commissions by affiliate
PATCH  /api/mlas/commissions/:id/approve   # Approve commission
PATCH  /api/mlas/commissions/:id/dispute   # Dispute commission
```

### Payout

```
POST   /api/mlas/payouts/schedule          # Schedule payout batch
POST   /api/mlas/payouts/:batchId/process  # Process payout batch
GET    /api/mlas/payouts/affiliate/:id     # Get payouts by affiliate
POST   /api/mlas/payouts/:id/retry         # Retry failed payout
GET    /api/mlas/payouts/:batchId/stats    # Get batch statistics
```

### Dispute

```
POST   /api/mlas/disputes                  # Create dispute
GET    /api/mlas/disputes/:id              # Get dispute
PATCH  /api/mlas/disputes/:id/resolve      # Resolve dispute
GET    /api/mlas/disputes/affiliate/:id    # Get disputes by affiliate
GET    /api/mlas/disputes/open             # Get open disputes
```

### Audit

```
GET    /api/mlas/audit/transactions        # Get transaction history
GET    /api/mlas/audit/affiliate/:id       # Get affiliate history
GET    /api/mlas/audit/export              # Export audit logs
```

## Revenue Models Supported

| Model | Description |
|-------|-------------|
| **Platform-First** | Platform takes cut first, remainder distributed to partners/affiliates |
| **Partner-Owned** | Partner owns revenue, pays platform a fee |
| **Client-Owned** | Client owns revenue, pays platform a fee |
| **Zero-Platform-Cut** | Platform takes no cut |
| **Hybrid** | Combination of models based on conditions |

## Commission Models

| Model | Description |
|-------|-------------|
| **Flat Rate** | Fixed commission amount per sale |
| **Percentage** | Percentage of sale amount |
| **Tiered** | Different rates based on sale amount thresholds |
| **Performance-Based** | Commission varies based on affiliate performance |
| **Hybrid** | Combination of multiple models |

## Payout Methods

| Method | Details |
|--------|---------|
| **Bank Transfer** | Direct to bank account |
| **PayPal** | PayPal account transfer |
| **Stripe** | Stripe Connect payout |
| **Crypto** | Blockchain transfer |
| **Internal Credit** | Platform account credit |

## Configuration

### Environment Variables

```bash
# Commission Rules
COMMISSION_RULE_PRIORITY=1
COMMISSION_FLAT_RATE=10
COMMISSION_PERCENTAGE=5
COMMISSION_TIER_REDUCTION=0.1

# Payout Settings
PAYOUT_BATCH_SIZE=100
PAYOUT_SCHEDULE_INTERVAL=7d
PAYOUT_RETRY_ATTEMPTS=3
PAYOUT_RETRY_BACKOFF=exponential

# Audit Settings
AUDIT_RETENTION_DAYS=2555
AUDIT_ENCRYPTION_ENABLED=true

# Revenue Models
REVENUE_MODEL=HYBRID
PLATFORM_CUT_PERCENTAGE=10
PARTNER_CUT_PERCENTAGE=20
```

## Testing

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
```

### Generate Coverage Report
```bash
npm run test:coverage
```

## Compliance

- ✅ GDPR compliant (data residency, audit trails)
- ✅ SOC 2 ready (access controls, audit logging)
- ✅ PCI DSS compliant (secure payout processing)
- ✅ Financial regulations (accurate record keeping)

## Monitoring & Observability

### Metrics Exposed

- Commission calculation success/failure rates
- Payout batch success/failure rates
- Active affiliate count
- Commission dispute rate
- Payout retry rate

### Logging

Structured JSON logging with levels:
- ERROR - Error events
- WARN - Warning events
- INFO - Informational events
- DEBUG - Debug events

### Dashboards

Grafana dashboards available for:
- Commission metrics
- Payout metrics
- Affiliate metrics
- System metrics

## Deployment

### Production Deployment

```bash
# Build
npm run build

# Set production environment
export NODE_ENV=production

# Run migrations
npm run migrate:up

# Start application
npm start
```

### Docker Deployment

```bash
# Build image
docker build -t webwaka-mlas .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://... \
  -e REDIS_URL=redis://... \
  webwaka-mlas
```

## Documentation

- **Architecture** - See [ARCH_CB1_MLAS.md](./docs/ARCH_CB1_MLAS.md)
- **API Documentation** - See [API_CB1_MLAS.md](./docs/API_CB1_MLAS.md)
- **Operational Runbook** - See [RUNBOOK_CB1_MLAS.md](./docs/RUNBOOK_CB1_MLAS.md)
- **Governance** - See [CB-1 Phase Definition](../../docs/phases/CB-1_MLAS_CAPABILITY.md)

## Troubleshooting

### Commission Calculation Issues
- Check commission rules are active
- Verify affiliate exists and is active
- Review error logs for details
- Verify sale data format matches rule conditions

### Payout Processing Issues
- Check payout batch status
- Verify affiliate payout details
- Check payout provider connectivity
- Review payout logs for errors

### Audit Trail Issues
- Verify audit service is running
- Check database connectivity
- Verify audit log table exists
- Check disk space for audit logs

## Support & Questions

- **Architecture** - See [ARCH_CB1_MLAS.md](./docs/ARCH_CB1_MLAS.md)
- **Operations** - See [RUNBOOK_CB1_MLAS.md](./docs/RUNBOOK_CB1_MLAS.md)
- **API** - See [API_CB1_MLAS.md](./docs/API_CB1_MLAS.md)

## License

PROPRIETARY - All rights reserved by WebWaka

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-30 | Initial implementation |

---

**For more information, see the [Architecture Document](./docs/ARCH_CB1_MLAS.md)**
