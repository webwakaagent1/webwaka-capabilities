import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cb4_products (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        sku VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        unit_of_measure VARCHAR(50) DEFAULT 'each',
        track_inventory BOOLEAN DEFAULT true,
        allow_negative_stock BOOLEAN DEFAULT false,
        reorder_point INTEGER,
        reorder_quantity INTEGER,
        inventory_strategy VARCHAR(20) DEFAULT 'FIFO',
        metadata JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, sku)
      );

      CREATE TABLE IF NOT EXISTS cb4_locations (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        location_type VARCHAR(30) NOT NULL,
        address TEXT,
        is_active BOOLEAN DEFAULT true,
        parent_location_id VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, code)
      );

      CREATE TABLE IF NOT EXISTS cb4_stock_levels (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL REFERENCES cb4_products(id),
        location_id VARCHAR(36) NOT NULL REFERENCES cb4_locations(id),
        quantity_on_hand DECIMAL(15,4) DEFAULT 0,
        quantity_reserved DECIMAL(15,4) DEFAULT 0,
        quantity_available DECIMAL(15,4) DEFAULT 0,
        quantity_in_transit DECIMAL(15,4) DEFAULT 0,
        last_counted_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, product_id, location_id)
      );

      CREATE TABLE IF NOT EXISTS cb4_stock_batches (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL REFERENCES cb4_products(id),
        location_id VARCHAR(36) NOT NULL REFERENCES cb4_locations(id),
        batch_number VARCHAR(100) NOT NULL,
        quantity DECIMAL(15,4) DEFAULT 0,
        cost_per_unit DECIMAL(15,4),
        expiry_date DATE,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, product_id, location_id, batch_number)
      );

      CREATE TABLE IF NOT EXISTS cb4_stock_movements (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL REFERENCES cb4_products(id),
        location_id VARCHAR(36) NOT NULL REFERENCES cb4_locations(id),
        movement_type VARCHAR(30) NOT NULL,
        quantity DECIMAL(15,4) NOT NULL,
        reference_type VARCHAR(50),
        reference_id VARCHAR(100),
        batch_id VARCHAR(36),
        cost_per_unit DECIMAL(15,4),
        reason TEXT,
        performed_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cb4_stock_transfers (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL REFERENCES cb4_products(id),
        from_location_id VARCHAR(36) NOT NULL REFERENCES cb4_locations(id),
        to_location_id VARCHAR(36) NOT NULL REFERENCES cb4_locations(id),
        quantity DECIMAL(15,4) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        initiated_by VARCHAR(100) NOT NULL,
        initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS cb4_reservations (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL REFERENCES cb4_products(id),
        location_id VARCHAR(36) NOT NULL REFERENCES cb4_locations(id),
        channel_id VARCHAR(36) NOT NULL,
        quantity DECIMAL(15,4) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        reference_type VARCHAR(50) NOT NULL,
        reference_id VARCHAR(100) NOT NULL,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cb4_channels (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        channel_type VARCHAR(30) NOT NULL,
        webhook_url TEXT,
        api_key VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, code)
      );

      CREATE TABLE IF NOT EXISTS cb4_channel_subscriptions (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        channel_id VARCHAR(36) NOT NULL REFERENCES cb4_channels(id),
        product_id VARCHAR(36) REFERENCES cb4_products(id),
        location_id VARCHAR(36) REFERENCES cb4_locations(id),
        event_types JSONB NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cb4_inventory_events (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        product_id VARCHAR(36),
        location_id VARCHAR(36),
        channel_id VARCHAR(36),
        payload JSONB NOT NULL,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cb4_inventory_audit_log (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(36) NOT NULL,
        action VARCHAR(50) NOT NULL,
        previous_state JSONB,
        new_state JSONB,
        performed_by VARCHAR(100) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_cb4_products_tenant ON cb4_products(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_cb4_stock_levels_product ON cb4_stock_levels(product_id);
      CREATE INDEX IF NOT EXISTS idx_cb4_stock_levels_location ON cb4_stock_levels(location_id);
      CREATE INDEX IF NOT EXISTS idx_cb4_stock_movements_product ON cb4_stock_movements(product_id);
      CREATE INDEX IF NOT EXISTS idx_cb4_stock_movements_created ON cb4_stock_movements(created_at);
      CREATE INDEX IF NOT EXISTS idx_cb4_reservations_product ON cb4_reservations(product_id);
      CREATE INDEX IF NOT EXISTS idx_cb4_reservations_status ON cb4_reservations(status);
      CREATE INDEX IF NOT EXISTS idx_cb4_inventory_events_type ON cb4_inventory_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_cb4_audit_entity ON cb4_inventory_audit_log(entity_type, entity_id);
    `);
    console.log('CB-4 Inventory Management database initialized');
  } finally {
    client.release();
  }
}

export { pool };
