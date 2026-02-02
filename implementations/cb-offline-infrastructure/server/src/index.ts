/**
 * WebWaka Offline-First Server Infrastructure
 * 
 * Implements server-side support for FD-2026-002 and FD-2026-003:
 * - Transaction sync endpoints
 * - Conflict detection and resolution
 * - Health check for reconnection detection
 */

import express from 'express';
import syncRoutes from './routes/sync';
import healthRoutes from './routes/health';
import { logger } from './services/Logger';

const app = express();
const PORT = parseInt(process.env.PORT || '5100', 10);

// Middleware
app.use(express.json({ limit: '10mb' }));

// CORS for development (configure appropriately for production)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Request logging
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'WebWaka Offline-First Infrastructure',
    version: '1.0.0',
    description: 'Server-side sync coordination and conflict management',
    endpoints: {
      health: '/health',
      sync: '/api/v1/sync',
      batch_sync: '/api/v1/sync/batch',
      stats: '/api/v1/sync/stats'
    },
    implemented_invariants: [
      'FD-2026-001: Offline-First Is Non-Negotiable',
      'FD-2026-002: Transaction Queue Persistence',
      'FD-2026-003: Sync-On-Reconnect Is Mandatory'
    ]
  });
});

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/sync', syncRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error_code: 'INTERNAL_ERROR',
    error_message: 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error_code: 'NOT_FOUND',
    error_message: `Endpoint not found: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// Start server
async function start() {
  try {
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`WebWaka Offline-First Infrastructure running on port ${PORT}`);
      logger.info('Implemented invariants: FD-2026-001, FD-2026-002, FD-2026-003');
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

start();

export default app;
