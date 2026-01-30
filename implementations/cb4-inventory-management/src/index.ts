import express from 'express';
import { initializeDatabase } from './config/database';
import { logger } from './utils/logger';
import productRoutes from './routes/products';
import locationRoutes from './routes/locations';
import inventoryRoutes from './routes/inventory';
import channelRoutes from './routes/channels';
import auditRoutes from './routes/audit';

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

app.get('/', (req, res) => {
  res.json({
    service: 'WebWaka CB-4 Inventory Management Capability',
    version: '1.0.0',
    description: 'Channel-agnostic inventory management - single source of truth for inventory',
    endpoints: {
      products: '/api/v1/products',
      locations: '/api/v1/locations',
      inventory: {
        stock: '/api/v1/inventory/stock',
        receive: '/api/v1/inventory/receive',
        sell: '/api/v1/inventory/sell',
        adjust: '/api/v1/inventory/adjust',
        movements: '/api/v1/inventory/movements',
        transfers: '/api/v1/inventory/transfers',
        reservations: '/api/v1/inventory/reservations',
      },
      channels: {
        channels: '/api/v1/channels',
        subscriptions: '/api/v1/channels/:channelId/subscriptions',
        events: '/api/v1/channels/events',
      },
      audit: '/api/v1/audit',
    },
    features: [
      'Core Inventory Service with FIFO/LIFO strategies',
      'Channel Subscription & Real-time Synchronization',
      'Stock Adjustments, Transfers & Reservations',
      'Full Audit Trail & Traceability',
    ],
    invariants: {
      'INV-002': 'Tenant Isolation - all operations scoped by tenant_id',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/v1/products', productRoutes);
app.use('/api/v1/locations', locationRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/channels', channelRoutes);
app.use('/api/v1/audit', auditRoutes);

async function start() {
  try {
    await initializeDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`CB-4 Inventory Management Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: (error as Error).message });
    process.exit(1);
  }
}

start();
