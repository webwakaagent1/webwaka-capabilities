# CB-OFFLINE: Offline-First Infrastructure

**Status:** ✅ Implemented  
**Version:** 1.0.0  
**Governing Invariants:** FD-2026-001, FD-2026-002, FD-2026-003

## Overview

The Offline-First Infrastructure capability provides a complete solution for building offline-capable applications in the WebWaka platform. It implements all requirements from the governing Founder Decisions for transaction queue persistence, automatic sync-on-reconnect, and conflict resolution.

## Architecture

This capability consists of two main components:

### 1. Client Library (`@webwaka/offline-client`)

A platform-agnostic TypeScript library that can be integrated into web and mobile applications.

**Key Features:**
- Transaction queue with IndexedDB (web) and SQLite (mobile) support
- Automatic sync-on-reconnect with network detection
- Exponential backoff retry logic
- Conflict detection and resolution
- Progress tracking and event callbacks
- Dead-letter queue for failed transactions

### 2. Server Infrastructure (`@webwaka/offline-server`)

Express-based server that provides sync coordination and conflict management.

**Key Features:**
- Transaction sync endpoints (single and batch)
- Health check endpoint for reconnection detection
- Conflict detection service
- Sync statistics and monitoring
- Audit logging

## Governing Invariants Compliance

### FD-2026-001: Offline-First Is Non-Negotiable
✅ **Implemented**
- All features function without real-time connectivity
- Offline storage and queueing are mandatory
- Tests validate offline behavior

### FD-2026-002: Transaction Queue Persistence
✅ **Implemented**

| Requirement | Implementation |
|------------|----------------|
| **Storage** | IndexedDB (web), SQLite adapter interface (mobile) |
| **Data Structure** | Complete 13-field transaction record per spec |
| **Durability** | Crash-resistant, power-loss resistant, atomic writes |
| **Queue Size** | Max 10,000 transactions with automatic eviction |
| **Lifecycle** | PENDING → IN_PROGRESS → SUCCEEDED/FAILED → DEAD_LETTER |

### FD-2026-003: Sync-On-Reconnect Is Mandatory
✅ **Implemented**

| Requirement | Implementation |
|------------|----------------|
| **Reconnection Detection** | Network status + API heartbeat (≥5s stable) |
| **Sync Initiation** | Automatic with 5s stabilization delay |
| **Conflict Resolution** | Server-wins strategy with version vectors |
| **Retry Logic** | Max 10 retries, exponential backoff (base 2, max 5min) |
| **Progress UI** | Event callbacks for progress tracking |
| **Partial Sync** | Continue on failure, per-transaction tracking |

## Installation

### Client Library

```bash
cd implementations/cb-offline-infrastructure/client
npm install
npm run build
```

### Server Infrastructure

```bash
cd implementations/cb-offline-infrastructure/server
npm install
npm run build
```

## Usage

### Client-Side Integration

```typescript
import {
  IndexedDBAdapter,
  TransactionQueue,
  SyncManager,
  OperationType
} from '@webwaka/offline-client';

// 1. Initialize storage
const storage = new IndexedDBAdapter({
  databaseName: 'my-app-offline',
  version: 1,
  debug: true
});

await storage.initialize();

// 2. Create transaction queue
const queue = new TransactionQueue({
  storage,
  debug: true
});

await queue.initialize();

// 3. Set up sync manager
const syncManager = new SyncManager({
  queue,
  reconnectionConfig: {
    healthCheckUrl: 'https://api.myapp.com/health',
    stabilizationDelayMs: 5000,
    healthCheckTimeoutMs: 3000
  },
  syncEndpoint: 'https://api.myapp.com/api/v1/sync',
  debug: true
});

await syncManager.initialize();

// 4. Listen to sync events
syncManager.on((event) => {
  console.log('Sync event:', event.type);
  
  if (event.progress) {
    console.log(`Progress: ${event.progress.synced}/${event.progress.total}`);
  }
});

// 5. Enqueue transactions
const transactionId = await queue.enqueue({
  operation_type: OperationType.CREATE,
  entity_type: 'document',
  entity_id: 'doc-123',
  payload: {
    title: 'My Document',
    content: 'Document content',
    version: '1.0'
  },
  client_version: '1.0.0',
  schema_version: '1.0'
});

// Transactions will automatically sync when connection is restored
```

### Server-Side Deployment

```bash
# Development
cd implementations/cb-offline-infrastructure/server
npm run dev

# Production
npm run build
npm start
```

**Environment Variables:**
- `PORT`: Server port (default: 5100)
- `LOG_LEVEL`: Logging level (default: info)

## API Endpoints

### Health Check
```
GET /health
```

Returns server health status for reconnection detection.

### Single Transaction Sync
```
POST /api/v1/sync
Content-Type: application/json

{
  "transaction": { ... },
  "client_timestamp": "2026-02-02T12:00:00.000Z"
}
```

### Batch Transaction Sync
```
POST /api/v1/sync/batch
Content-Type: application/json

{
  "transactions": [
    {
      "transaction": { ... },
      "client_timestamp": "2026-02-02T12:00:00.000Z"
    }
  ]
}
```

### Sync Statistics
```
GET /api/v1/sync/stats
```

Returns sync performance metrics.

## Testing

### Client Library Tests
```bash
cd implementations/cb-offline-infrastructure/client
npm test
npm run test:coverage
```

### Server Tests
```bash
cd implementations/cb-offline-infrastructure/server
npm test
npm run test:coverage
```

## Integration Guide

For detailed integration instructions, see [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md).

## Transaction Data Structure

Per FD-2026-002 Section 2.2, each transaction contains:

```typescript
interface Transaction {
  transaction_id: string;      // UUID v4
  created_at: string;          // ISO-8601
  operation_type: OperationType;
  entity_type: string;
  entity_id: string;
  payload: Record<string, any>;
  status: TransactionStatus;
  retry_count: number;
  last_attempt_at: string | null;
  error_code: string | null;
  error_message: string | null;
  client_version: string;
  schema_version: string;
}
```

## Conflict Resolution

The system uses a **server-wins** strategy by default per FD-2026-003 Section 2.3:

1. Conflicts are detected using version vectors and timestamps
2. Server data takes precedence when conflicts occur
3. All conflicts are logged in an audit trail
4. Conflicts are surfaced to the user with clear details

## Retry Logic

Per FD-2026-003 Section 2.4:

- **Max Retries:** 10 per transaction
- **Backoff Strategy:** Exponential (base 2, max 5 minutes)
- **Max Retry Window:** 24 hours
- **Failure Action:** Move to DEAD_LETTER queue after exhaustion

## Dead Letter Queue

Transactions are moved to the dead letter queue when:
- Max retries (10) are exhausted
- Retry window (24 hours) is exceeded
- Queue size limit (10,000) is reached and eviction is needed

Dead letter transactions require manual intervention or can be retried programmatically.

## Performance Considerations

- **Queue Size:** Limited to 10,000 transactions to prevent memory issues
- **Batch Sync:** Use batch endpoint for syncing multiple transactions efficiently
- **Indexing:** IndexedDB uses indexes on `status` and `created_at` for fast queries
- **Backoff:** Exponential backoff prevents server overload during outages

## Security Considerations

- **Authentication:** Implement proper authentication on sync endpoints
- **Authorization:** Validate user permissions before applying transactions
- **Input Validation:** Validate all transaction payloads before processing
- **Rate Limiting:** Implement rate limiting on sync endpoints
- **Encryption:** Use HTTPS for all sync communication

## Monitoring

The server provides sync statistics via `/api/v1/sync/stats`:

```json
{
  "total_syncs": 1250,
  "successful_syncs": 1180,
  "failed_syncs": 70,
  "conflicts_detected": 15,
  "dead_letter_count": 5,
  "average_sync_duration_ms": 45
}
```

## Troubleshooting

### Transactions Not Syncing

1. Check network connectivity
2. Verify health check endpoint is accessible
3. Check browser console for sync events
4. Inspect transaction status in queue

### High Conflict Rate

1. Review conflict audit log
2. Check client-side version tracking
3. Verify server-side entity versioning
4. Consider adjusting conflict resolution strategy

### Queue Full

1. Check for stuck transactions
2. Review dead letter queue
3. Increase queue size if appropriate
4. Implement queue cleanup strategy

## Future Enhancements

- SQLite adapter implementation for React Native
- Configurable conflict resolution strategies
- Transaction compression for large payloads
- Sync progress persistence across app restarts
- Advanced conflict resolution UI components

## License

Copyright © 2026 WebWaka. All rights reserved.

## Support

For issues or questions, please refer to the WebWaka governance repository or contact the development team.
