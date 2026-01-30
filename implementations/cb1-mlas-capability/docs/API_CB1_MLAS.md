# CB-1 MLAS API Documentation

**Version:** 1.0.0  
**Base URL:** `/api/mlas`  
**Authentication:** Bearer Token (JWT)

---

## 1. Attribution Endpoints

### 1.1 Track Attribution

**Endpoint:** `POST /attributions`

**Description:** Track a sale attribution to an affiliate.

**Request:**
```json
{
  "saleId": "sale-123",
  "affiliateId": "aff-456",
  "affiliateChain": ["aff-456", "aff-123"],
  "attributionType": "DIRECT"
}
```

**Response (201):**
```json
{
  "id": "attr-789",
  "tenantId": "tenant-1",
  "saleId": "sale-123",
  "affiliateId": "aff-456",
  "affiliateChain": ["aff-456", "aff-123"],
  "attributionType": "DIRECT",
  "attributionWeight": "1.0",
  "createdAt": "2026-01-30T10:00:00Z"
}
```

**Error Responses:**
- 400: Invalid attribution parameters
- 401: Unauthorized
- 403: Forbidden
- 500: Internal server error

---

### 1.2 Get Attributions by Sale

**Endpoint:** `GET /attributions/:saleId`

**Description:** Get all attributions for a specific sale.

**Response (200):**
```json
{
  "data": [
    {
      "id": "attr-789",
      "saleId": "sale-123",
      "affiliateId": "aff-456",
      "affiliateChain": ["aff-456", "aff-123"],
      "attributionType": "DIRECT",
      "attributionWeight": "1.0",
      "createdAt": "2026-01-30T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

### 1.3 Get Attributions by Affiliate

**Endpoint:** `GET /attributions/affiliate/:affiliateId`

**Description:** Get all attributions for a specific affiliate.

**Query Parameters:**
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)
- `startDate` (optional): Filter by start date (ISO 8601)
- `endDate` (optional): Filter by end date (ISO 8601)

**Response (200):**
```json
{
  "data": [
    {
      "id": "attr-789",
      "saleId": "sale-123",
      "affiliateId": "aff-456",
      "attributionType": "DIRECT",
      "attributionWeight": "1.0",
      "createdAt": "2026-01-30T10:00:00Z"
    }
  ],
  "total": 50,
  "limit": 100,
  "offset": 0
}
```

---

## 2. Commission Endpoints

### 2.1 Calculate Commissions

**Endpoint:** `POST /commissions/calculate`

**Description:** Calculate commissions for a sale.

**Request:**
```json
{
  "saleId": "sale-123",
  "saleAmount": 1000,
  "affiliateChain": ["aff-456", "aff-123"],
  "ruleId": "rule-789"
}
```

**Response (201):**
```json
{
  "data": [
    {
      "id": "comm-1",
      "saleId": "sale-123",
      "affiliateId": "aff-456",
      "affiliateChain": ["aff-456", "aff-123"],
      "commissionRuleId": "rule-789",
      "grossAmount": "1000",
      "commissionAmount": "100",
      "commissionRate": "10",
      "netAmount": "900",
      "status": "CALCULATED",
      "calculatedAt": "2026-01-30T10:00:00Z"
    },
    {
      "id": "comm-2",
      "saleId": "sale-123",
      "affiliateId": "aff-123",
      "affiliateChain": ["aff-456", "aff-123"],
      "commissionRuleId": "rule-789",
      "grossAmount": "1000",
      "commissionAmount": "80",
      "commissionRate": "8",
      "netAmount": "920",
      "status": "CALCULATED",
      "calculatedAt": "2026-01-30T10:00:00Z"
    }
  ],
  "total": 2
}
```

---

### 2.2 Get Commission

**Endpoint:** `GET /commissions/:commissionId`

**Description:** Get a specific commission.

**Response (200):**
```json
{
  "id": "comm-1",
  "saleId": "sale-123",
  "affiliateId": "aff-456",
  "commissionAmount": "100",
  "status": "CALCULATED",
  "calculatedAt": "2026-01-30T10:00:00Z"
}
```

---

### 2.3 Get Commissions by Affiliate

**Endpoint:** `GET /commissions/affiliate/:affiliateId`

**Description:** Get all commissions for an affiliate.

**Query Parameters:**
- `status` (optional): Filter by status (PENDING, CALCULATED, APPROVED, DISPUTED, PAID)
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response (200):**
```json
{
  "data": [
    {
      "id": "comm-1",
      "saleId": "sale-123",
      "affiliateId": "aff-456",
      "commissionAmount": "100",
      "status": "APPROVED",
      "calculatedAt": "2026-01-30T10:00:00Z"
    }
  ],
  "total": 25,
  "limit": 100,
  "offset": 0
}
```

---

### 2.4 Approve Commission

**Endpoint:** `PATCH /commissions/:commissionId/approve`

**Description:** Approve a commission for payout.

**Response (200):**
```json
{
  "id": "comm-1",
  "status": "APPROVED",
  "updatedAt": "2026-01-30T10:05:00Z"
}
```

---

### 2.5 Dispute Commission

**Endpoint:** `PATCH /commissions/:commissionId/dispute`

**Description:** Dispute a commission.

**Request:**
```json
{
  "reason": "INCORRECT_CALCULATION",
  "description": "Commission calculated incorrectly"
}
```

**Response (200):**
```json
{
  "id": "comm-1",
  "status": "DISPUTED",
  "dispute": {
    "id": "disp-123",
    "reason": "INCORRECT_CALCULATION",
    "status": "OPEN"
  },
  "updatedAt": "2026-01-30T10:05:00Z"
}
```

---

## 3. Payout Endpoints

### 3.1 Schedule Payout Batch

**Endpoint:** `POST /payouts/schedule`

**Description:** Schedule a payout batch for approved commissions.

**Request:**
```json
{
  "commissionIds": ["comm-1", "comm-2", "comm-3"],
  "scheduledDate": "2026-02-06T00:00:00Z"
}
```

**Response (201):**
```json
{
  "id": "batch-1",
  "batchNumber": "BATCH-001",
  "commissionIds": ["comm-1", "comm-2", "comm-3"],
  "totalAmount": "280",
  "status": "SCHEDULED",
  "scheduledDate": "2026-02-06T00:00:00Z",
  "createdAt": "2026-01-30T10:00:00Z"
}
```

---

### 3.2 Process Payout Batch

**Endpoint:** `POST /payouts/:batchId/process`

**Description:** Process a scheduled payout batch.

**Response (200):**
```json
{
  "id": "batch-1",
  "status": "PROCESSING",
  "totalPayouts": 3,
  "completedPayouts": 0,
  "failedPayouts": 0,
  "updatedAt": "2026-01-30T10:05:00Z"
}
```

---

### 3.3 Get Payouts by Affiliate

**Endpoint:** `GET /payouts/affiliate/:affiliateId`

**Description:** Get all payouts for an affiliate.

**Query Parameters:**
- `status` (optional): Filter by status (SCHEDULED, PROCESSING, COMPLETED, FAILED)
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response (200):**
```json
{
  "data": [
    {
      "id": "payout-1",
      "batchId": "batch-1",
      "affiliateId": "aff-456",
      "amount": "100",
      "payoutMethod": "BANK_TRANSFER",
      "status": "COMPLETED",
      "transactionId": "txn-123",
      "processedAt": "2026-02-06T10:00:00Z",
      "createdAt": "2026-01-30T10:00:00Z"
    }
  ],
  "total": 10,
  "limit": 100,
  "offset": 0
}
```

---

### 3.4 Retry Failed Payout

**Endpoint:** `POST /payouts/:payoutId/retry`

**Description:** Retry a failed payout.

**Response (200):**
```json
{
  "id": "payout-1",
  "status": "SCHEDULED",
  "updatedAt": "2026-01-30T10:05:00Z"
}
```

---

### 3.5 Get Batch Statistics

**Endpoint:** `GET /payouts/:batchId/stats`

**Description:** Get statistics for a payout batch.

**Response (200):**
```json
{
  "batchId": "batch-1",
  "batchNumber": "BATCH-001",
  "totalPayouts": 3,
  "completedPayouts": 2,
  "failedPayouts": 1,
  "pendingPayouts": 0,
  "totalAmount": "280",
  "completedAmount": "200",
  "successRate": "66.67",
  "status": "PROCESSING"
}
```

---

## 4. Dispute Endpoints

### 4.1 Create Dispute

**Endpoint:** `POST /disputes`

**Description:** Create a dispute for a commission.

**Request:**
```json
{
  "commissionId": "comm-1",
  "reason": "INCORRECT_CALCULATION",
  "description": "The commission was calculated incorrectly",
  "evidence": ["evidence-1", "evidence-2"]
}
```

**Response (201):**
```json
{
  "id": "disp-123",
  "commissionId": "comm-1",
  "affiliateId": "aff-456",
  "reason": "INCORRECT_CALCULATION",
  "description": "The commission was calculated incorrectly",
  "status": "OPEN",
  "evidence": ["evidence-1", "evidence-2"],
  "createdAt": "2026-01-30T10:00:00Z"
}
```

---

### 4.2 Get Dispute

**Endpoint:** `GET /disputes/:disputeId`

**Description:** Get a specific dispute.

**Response (200):**
```json
{
  "id": "disp-123",
  "commissionId": "comm-1",
  "affiliateId": "aff-456",
  "reason": "INCORRECT_CALCULATION",
  "status": "OPEN",
  "createdAt": "2026-01-30T10:00:00Z"
}
```

---

### 4.3 Resolve Dispute

**Endpoint:** `PATCH /disputes/:disputeId/resolve`

**Description:** Resolve a dispute.

**Request:**
```json
{
  "resolutionType": "PARTIAL_APPROVAL",
  "adjustmentAmount": "50",
  "notes": "Partial approval - affiliate entitled to 50% of disputed amount"
}
```

**Response (200):**
```json
{
  "id": "disp-123",
  "status": "RESOLVED",
  "resolution": {
    "resolutionType": "PARTIAL_APPROVAL",
    "adjustmentAmount": "50",
    "notes": "Partial approval - affiliate entitled to 50% of disputed amount"
  },
  "resolvedAt": "2026-01-30T10:05:00Z",
  "updatedAt": "2026-01-30T10:05:00Z"
}
```

---

### 4.4 Get Disputes by Affiliate

**Endpoint:** `GET /disputes/affiliate/:affiliateId`

**Description:** Get all disputes for an affiliate.

**Query Parameters:**
- `status` (optional): Filter by status (OPEN, UNDER_REVIEW, RESOLVED, APPEALED, CLOSED)
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response (200):**
```json
{
  "data": [
    {
      "id": "disp-123",
      "commissionId": "comm-1",
      "affiliateId": "aff-456",
      "reason": "INCORRECT_CALCULATION",
      "status": "RESOLVED",
      "createdAt": "2026-01-30T10:00:00Z"
    }
  ],
  "total": 5,
  "limit": 100,
  "offset": 0
}
```

---

### 4.5 Get Open Disputes

**Endpoint:** `GET /disputes/open`

**Description:** Get all open disputes for a tenant.

**Query Parameters:**
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response (200):**
```json
{
  "data": [
    {
      "id": "disp-123",
      "commissionId": "comm-1",
      "affiliateId": "aff-456",
      "reason": "INCORRECT_CALCULATION",
      "status": "OPEN",
      "createdAt": "2026-01-30T10:00:00Z"
    }
  ],
  "total": 12,
  "limit": 100,
  "offset": 0
}
```

---

## 5. Audit Endpoints

### 5.1 Get Transaction History

**Endpoint:** `GET /audit/transactions`

**Description:** Get transaction history with optional filters.

**Query Parameters:**
- `transactionType` (optional): Filter by transaction type
- `status` (optional): Filter by status (PENDING, SUCCESS, FAILED)
- `actor` (optional): Filter by actor ID
- `startDate` (optional): Filter by start date (ISO 8601)
- `endDate` (optional): Filter by end date (ISO 8601)
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response (200):**
```json
{
  "data": [
    {
      "id": "txn-1",
      "transactionType": "COMMISSION_CALCULATED",
      "actor": {
        "id": "aff-456",
        "type": "AFFILIATE",
        "name": "John Affiliate"
      },
      "resource": {
        "type": "commission",
        "id": "comm-1"
      },
      "changes": {
        "commissionAmount": "100",
        "status": "CALCULATED"
      },
      "status": "SUCCESS",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2026-01-30T10:00:00Z"
    }
  ],
  "total": 500,
  "limit": 100,
  "offset": 0
}
```

---

### 5.2 Get Affiliate History

**Endpoint:** `GET /audit/affiliate/:affiliateId`

**Description:** Get transaction history for a specific affiliate.

**Query Parameters:**
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response (200):**
```json
{
  "data": [
    {
      "id": "txn-1",
      "transactionType": "AFFILIATE_CREATED",
      "actor": {
        "id": "admin-1",
        "type": "PARTNER",
        "name": "Admin User"
      },
      "resource": {
        "type": "affiliate",
        "id": "aff-456",
        "name": "John Affiliate"
      },
      "status": "SUCCESS",
      "createdAt": "2026-01-30T10:00:00Z"
    }
  ],
  "total": 50,
  "limit": 100,
  "offset": 0
}
```

---

### 5.3 Export Audit Logs

**Endpoint:** `GET /audit/export`

**Description:** Export audit logs in JSON or CSV format.

**Query Parameters:**
- `format` (optional): Export format (json, csv) (default: json)
- `startDate` (optional): Export start date (ISO 8601)
- `endDate` (optional): Export end date (ISO 8601)

**Response (200):**
```json
[
  {
    "id": "txn-1",
    "transactionType": "COMMISSION_CALCULATED",
    "status": "SUCCESS",
    "createdAt": "2026-01-30T10:00:00Z"
  }
]
```

---

## 6. Error Responses

### 6.1 Error Format

All error responses follow this format:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request parameters",
    "details": {
      "field": "saleAmount",
      "reason": "Must be greater than 0"
    }
  }
}
```

### 6.2 Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| INVALID_REQUEST | 400 | Invalid request parameters |
| UNAUTHORIZED | 401 | Missing or invalid authentication |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource already exists |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Internal server error |

---

## 7. Rate Limiting

API endpoints are rate limited:

- **Authentication endpoints:** 5 requests per minute per IP
- **Commission endpoints:** 100 requests per minute per user
- **Payout endpoints:** 50 requests per minute per user
- **Audit endpoints:** 100 requests per minute per user

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1643462400
```

---

## 8. Webhooks

### 8.1 Dispute Created Webhook

```json
{
  "event": "dispute.created",
  "data": {
    "id": "disp-123",
    "commissionId": "comm-1",
    "affiliateId": "aff-456",
    "reason": "INCORRECT_CALCULATION",
    "status": "OPEN",
    "createdAt": "2026-01-30T10:00:00Z"
  },
  "timestamp": "2026-01-30T10:00:00Z"
}
```

### 8.2 Dispute Resolved Webhook

```json
{
  "event": "dispute.resolved",
  "data": {
    "id": "disp-123",
    "status": "RESOLVED",
    "resolution": {
      "resolutionType": "APPROVED",
      "adjustmentAmount": "100"
    },
    "resolvedAt": "2026-01-30T10:05:00Z"
  },
  "timestamp": "2026-01-30T10:05:00Z"
}
```

---

**API Version:** 1.0.0  
**Last Updated:** January 30, 2026

---

**End of API Documentation**
