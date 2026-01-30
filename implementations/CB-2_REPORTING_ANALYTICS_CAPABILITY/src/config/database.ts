import { Pool } from 'pg';
import { logger } from '../utils/logger';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected database error', { error: err.message });
});

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    logger.info('Database connection established');
  } finally {
    client.release();
  }
}

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    const migrationSQL = `
      -- Metrics table for storing raw metric events
      CREATE TABLE IF NOT EXISTS cb2_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(255) NOT NULL,
        metric_type VARCHAR(100) NOT NULL,
        metric_name VARCHAR(255) NOT NULL,
        value DECIMAL(20, 4) NOT NULL,
        dimensions JSONB DEFAULT '{}',
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        source VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Aggregations table for pre-computed aggregates
      CREATE TABLE IF NOT EXISTS cb2_aggregations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(255) NOT NULL,
        aggregation_type VARCHAR(50) NOT NULL,
        metric_name VARCHAR(255) NOT NULL,
        period_start TIMESTAMP WITH TIME ZONE NOT NULL,
        period_end TIMESTAMP WITH TIME ZONE NOT NULL,
        granularity VARCHAR(20) NOT NULL,
        dimensions JSONB DEFAULT '{}',
        sum_value DECIMAL(20, 4) DEFAULT 0,
        count_value INTEGER DEFAULT 0,
        min_value DECIMAL(20, 4),
        max_value DECIMAL(20, 4),
        avg_value DECIMAL(20, 4),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(tenant_id, metric_name, period_start, granularity, dimensions)
      );

      -- Report definitions table
      CREATE TABLE IF NOT EXISTS cb2_report_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        description TEXT,
        report_type VARCHAR(50) NOT NULL,
        config JSONB NOT NULL,
        is_system BOOLEAN DEFAULT FALSE,
        created_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(tenant_id, slug)
      );

      -- Dashboard definitions table
      CREATE TABLE IF NOT EXISTS cb2_dashboards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        description TEXT,
        layout JSONB DEFAULT '[]',
        widgets JSONB DEFAULT '[]',
        is_default BOOLEAN DEFAULT FALSE,
        created_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(tenant_id, slug)
      );

      -- Widget definitions table
      CREATE TABLE IF NOT EXISTS cb2_widgets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        widget_type VARCHAR(50) NOT NULL,
        config JSONB NOT NULL,
        data_source JSONB NOT NULL,
        is_system BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Scheduled reports table
      CREATE TABLE IF NOT EXISTS cb2_scheduled_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(255) NOT NULL,
        report_definition_id UUID REFERENCES cb2_report_definitions(id),
        schedule_cron VARCHAR(100) NOT NULL,
        recipients JSONB DEFAULT '[]',
        export_format VARCHAR(20) DEFAULT 'pdf',
        is_active BOOLEAN DEFAULT TRUE,
        last_run_at TIMESTAMP WITH TIME ZONE,
        next_run_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Report executions log
      CREATE TABLE IF NOT EXISTS cb2_report_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(255) NOT NULL,
        report_definition_id UUID REFERENCES cb2_report_definitions(id),
        executed_by VARCHAR(255),
        parameters JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'pending',
        result_data JSONB,
        export_url VARCHAR(500),
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_cb2_metrics_tenant_type ON cb2_metrics(tenant_id, metric_type);
      CREATE INDEX IF NOT EXISTS idx_cb2_metrics_tenant_name_ts ON cb2_metrics(tenant_id, metric_name, timestamp);
      CREATE INDEX IF NOT EXISTS idx_cb2_aggregations_tenant_metric ON cb2_aggregations(tenant_id, metric_name, period_start);
      CREATE INDEX IF NOT EXISTS idx_cb2_report_defs_tenant ON cb2_report_definitions(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_cb2_dashboards_tenant ON cb2_dashboards(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_cb2_executions_tenant ON cb2_report_executions(tenant_id);
    `;

    await client.query(migrationSQL);
    logger.info('Database migrations applied');
  } finally {
    client.release();
  }
}
