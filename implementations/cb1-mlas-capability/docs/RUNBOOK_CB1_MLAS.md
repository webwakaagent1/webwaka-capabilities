# CB-1 MLAS Operational Runbook

**Version:** 1.0.0  
**Date:** January 30, 2026  
**Audience:** Operations, DevOps, Platform Engineers

---

## 1. Quick Start

### 1.1 System Startup

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run database migrations
npm run migrate:up

# Start the service
npm start
```

### 1.2 Health Check

```bash
# Check service health
curl http://localhost:3000/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2026-01-30T10:00:00Z",
#   "version": "1.0.0"
# }
```

---

## 2. Common Operations

### 2.1 Creating an Affiliate

```bash
curl -X POST http://localhost:3000/api/mlas/affiliates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "organizationId": "org-123",
    "name": "John Affiliate",
    "email": "john@example.com",
    "commissionRate": 10,
    "payoutMethod": "BANK_TRANSFER",
    "payoutDetails": {
      "accountNumber": "1234567890",
      "routingNumber": "021000021",
      "bankName": "Chase Bank",
      "accountHolderName": "John Affiliate"
    }
  }'
```

### 2.2 Tracking a Sale Attribution

```bash
curl -X POST http://localhost:3000/api/mlas/attributions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "saleId": "sale-456",
    "affiliateId": "aff-123",
    "affiliateChain": ["aff-123", "aff-456"],
    "attributionType": "DIRECT"
  }'
```

### 2.3 Calculating Commissions

```bash
curl -X POST http://localhost:3000/api/mlas/commissions/calculate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "saleId": "sale-456",
    "saleAmount": 1000,
    "affiliateChain": ["aff-123", "aff-456"]
  }'
```

### 2.4 Scheduling Payouts

```bash
curl -X POST http://localhost:3000/api/mlas/payouts/schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "commissionIds": ["comm-1", "comm-2", "comm-3"],
    "scheduledDate": "2026-02-06T00:00:00Z"
  }'
```

### 2.5 Processing a Payout Batch

```bash
curl -X POST http://localhost:3000/api/mlas/payouts/batch-123/process \
  -H "Authorization: Bearer $TOKEN"
```

---

## 3. Monitoring & Alerting

### 3.1 Key Metrics to Monitor

**Commission Metrics:**
- Commission calculation success rate
- Average commission amount
- Commission approval rate
- Commission dispute rate

**Payout Metrics:**
- Payout batch success rate
- Payout processing time
- Failed payout count
- Payout retry rate

**Affiliate Metrics:**
- Active affiliate count
- Affiliate tier distribution
- Commission rate distribution
- Payout method distribution

**System Metrics:**
- API response time
- Database query time
- Cache hit rate
- Error rate

### 3.2 Alert Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Commission calculation failure rate | > 5% | Page on-call engineer |
| Payout processing failure rate | > 10% | Page on-call engineer |
| API response time (p95) | > 1000ms | Investigate performance |
| Database query time (p95) | > 500ms | Investigate query optimization |
| Error rate | > 1% | Investigate root cause |

### 3.3 Logging

```bash
# View logs
docker logs mlas-service

# Filter logs by level
docker logs mlas-service | grep ERROR

# Follow logs in real-time
docker logs -f mlas-service
```

---

## 4. Troubleshooting

### 4.1 Commission Calculation Issues

**Problem:** Commission calculations are failing

**Solution:**
1. Check commission rules are active: `GET /api/mlas/rules`
2. Verify affiliate exists: `GET /api/mlas/affiliates/:id`
3. Check affiliate is active: `affiliateStatus === ACTIVE`
4. Review error logs: `docker logs mlas-service | grep ERROR`
5. Verify sale data format matches rule conditions

**Example Debug:**
```bash
# Get commission calculation details
curl http://localhost:3000/api/mlas/commissions/comm-123

# Get audit trail for commission
curl http://localhost:3000/api/mlas/audit/transactions?resourceId=comm-123
```

### 4.2 Payout Processing Issues

**Problem:** Payouts are failing to process

**Solution:**
1. Check payout batch status: `GET /api/mlas/payouts/batch/:batchId`
2. Verify affiliate payout details: `GET /api/mlas/affiliates/:id`
3. Check payout provider connectivity
4. Review payout logs: `docker logs mlas-service | grep payout`
5. Retry failed payouts: `POST /api/mlas/payouts/:payoutId/retry`

**Example Debug:**
```bash
# Get batch statistics
curl http://localhost:3000/api/mlas/payouts/batch/batch-123/stats

# Get failed payouts
curl http://localhost:3000/api/mlas/payouts?status=FAILED

# Retry a failed payout
curl -X POST http://localhost:3000/api/mlas/payouts/payout-123/retry
```

### 4.3 Audit Trail Issues

**Problem:** Audit trail is not recording transactions

**Solution:**
1. Verify audit service is running
2. Check database connectivity
3. Verify audit log table exists
4. Check disk space for audit logs
5. Review audit service logs

**Example Debug:**
```bash
# Get recent audit transactions
curl http://localhost:3000/api/mlas/audit/transactions?limit=10

# Get audit transactions for specific affiliate
curl http://localhost:3000/api/mlas/audit/affiliate/aff-123
```

### 4.4 Database Issues

**Problem:** Database connection errors

**Solution:**
1. Check PostgreSQL is running: `psql -h localhost -U postgres -d mlas`
2. Verify credentials in environment variables
3. Check database exists: `\l` in psql
4. Verify tables exist: `\dt` in psql
5. Check disk space: `df -h`

**Example Commands:**
```bash
# Connect to database
psql -h localhost -U postgres -d mlas

# Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Check slow queries
SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
```

---

## 5. Maintenance Tasks

### 5.1 Database Maintenance

**Weekly:**
```bash
# Vacuum and analyze
VACUUM ANALYZE;

# Check for bloat
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
```

**Monthly:**
```bash
# Reindex tables
REINDEX DATABASE mlas;

# Update statistics
ANALYZE;
```

### 5.2 Audit Log Maintenance

**Quarterly:**
```bash
# Archive old audit logs (older than 1 year)
DELETE FROM audit_logs 
WHERE created_at < NOW() - INTERVAL '1 year';

# Vacuum audit log table
VACUUM ANALYZE audit_logs;
```

### 5.3 Cache Maintenance

**Daily:**
```bash
# Check Redis memory usage
redis-cli INFO memory

# Clear expired keys
redis-cli FLUSHDB ASYNC
```

---

## 6. Backup & Recovery

### 6.1 Database Backup

```bash
# Full backup
pg_dump -h localhost -U postgres -d mlas > mlas_backup.sql

# Compressed backup
pg_dump -h localhost -U postgres -d mlas | gzip > mlas_backup.sql.gz

# Backup with custom format
pg_dump -h localhost -U postgres -d mlas -Fc > mlas_backup.dump
```

### 6.2 Database Restore

```bash
# From SQL backup
psql -h localhost -U postgres -d mlas < mlas_backup.sql

# From compressed backup
gunzip -c mlas_backup.sql.gz | psql -h localhost -U postgres -d mlas

# From custom format
pg_restore -h localhost -U postgres -d mlas mlas_backup.dump
```

### 6.3 Audit Log Backup

```bash
# Export audit logs to CSV
\COPY audit_logs TO 'audit_logs_backup.csv' WITH CSV HEADER;

# Export audit logs to JSON
SELECT json_agg(row_to_json(t)) FROM audit_logs t > audit_logs_backup.json;
```

---

## 7. Performance Tuning

### 7.1 Database Optimization

**Index Creation:**
```sql
-- Commission lookups
CREATE INDEX idx_commissions_affiliate ON commissions(affiliate_id);
CREATE INDEX idx_commissions_sale ON commissions(sale_id);
CREATE INDEX idx_commissions_status ON commissions(status);

-- Payout lookups
CREATE INDEX idx_payouts_batch ON payouts(batch_id);
CREATE INDEX idx_payouts_affiliate ON payouts(affiliate_id);
CREATE INDEX idx_payouts_status ON payouts(status);

-- Audit lookups
CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_audit_type ON audit_logs(transaction_type);
```

### 7.2 Query Optimization

```bash
# Enable query logging
SET log_min_duration_statement = 1000;  -- Log queries > 1 second

# Analyze query plan
EXPLAIN ANALYZE SELECT * FROM commissions WHERE affiliate_id = 'aff-123';
```

### 7.3 Connection Pooling

```bash
# Configure PgBouncer for connection pooling
# /etc/pgbouncer/pgbouncer.ini
[databases]
mlas = host=localhost port=5432 dbname=mlas

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

---

## 8. Scaling

### 8.1 Horizontal Scaling

```bash
# Deploy multiple instances behind load balancer
docker-compose up -d --scale mlas-service=3

# Configure load balancer (nginx)
upstream mlas_backend {
  server mlas-service-1:3000;
  server mlas-service-2:3000;
  server mlas-service-3:3000;
}

server {
  listen 80;
  location / {
    proxy_pass http://mlas_backend;
  }
}
```

### 8.2 Vertical Scaling

```bash
# Increase resource allocation
docker update --memory=4g --cpus=2 mlas-service

# Increase database resources
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET work_mem = '10MB';
SELECT pg_reload_conf();
```

---

## 9. Incident Response

### 9.1 Commission Calculation Outage

**Detection:**
- Commission calculation API returns errors
- Error rate > 50%

**Response:**
1. Check service logs: `docker logs mlas-service`
2. Verify database connectivity
3. Check commission rules are active
4. Restart service if needed: `docker restart mlas-service`
5. If issue persists, rollback to previous version

**Recovery:**
1. Identify affected commissions
2. Recalculate affected commissions
3. Verify calculations are correct
4. Resume normal operations

### 9.2 Payout Processing Failure

**Detection:**
- Payout batch fails to process
- Error rate > 10%

**Response:**
1. Check payout provider status
2. Verify payout credentials
3. Check batch integrity
4. Review payout logs
5. Retry failed payouts

**Recovery:**
1. Identify failed payouts
2. Verify payout details
3. Retry with corrected details
4. Monitor retry progress
5. Notify affected affiliates

### 9.3 Database Failure

**Detection:**
- Database connection errors
- Query timeouts

**Response:**
1. Check PostgreSQL status: `pg_isready`
2. Check disk space: `df -h`
3. Check memory: `free -h`
4. Check connections: `SELECT count(*) FROM pg_stat_activity;`
5. Restart database if needed

**Recovery:**
1. Restore from backup if needed
2. Verify data integrity
3. Resume operations
4. Monitor for issues

---

## 10. Runbook Maintenance

This runbook should be updated:
- When new features are added
- When operational procedures change
- When new issues are discovered
- Quarterly for review and refresh

**Last Updated:** January 30, 2026  
**Next Review:** April 30, 2026

---

**End of Operational Runbook**
