/**
 * Health Check Routes
 * 
 * Provides health check endpoint for reconnection detection per FD-2026-003 Section 2.1
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /health
 * Simple health check endpoint
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'webwaka-offline-infrastructure'
  });
});

/**
 * GET /health/detailed
 * Detailed health check with system information
 */
router.get('/detailed', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'webwaka-offline-infrastructure',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

export default router;
