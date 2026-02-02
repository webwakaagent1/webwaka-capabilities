/**
 * Sync Routes - Server-side sync endpoints
 * 
 * Handles incoming sync requests from clients per FD-2026-003
 */

import { Router, Request, Response } from 'express';
import { SyncRequest, SyncResponse } from '../types';
import { SyncProcessor } from '../services/SyncProcessor';
import { logger } from '../services/Logger';

const router = Router();
const syncProcessor = new SyncProcessor();

/**
 * POST /api/v1/sync
 * Process a single transaction sync request
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const syncRequest: SyncRequest = req.body;

    if (!syncRequest.transaction || !syncRequest.client_timestamp) {
      return res.status(400).json({
        success: false,
        error_code: 'INVALID_REQUEST',
        error_message: 'Missing required fields: transaction, client_timestamp'
      });
    }

    logger.info('Processing sync request', {
      transaction_id: syncRequest.transaction.transaction_id,
      entity_type: syncRequest.transaction.entity_type,
      operation_type: syncRequest.transaction.operation_type
    });

    const response: SyncResponse = await syncProcessor.processTransaction(syncRequest);

    const statusCode = response.success ? 200 : response.conflict ? 409 : 500;
    res.status(statusCode).json(response);

  } catch (error) {
    logger.error('Sync request failed', { error });
    res.status(500).json({
      success: false,
      error_code: 'INTERNAL_ERROR',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      server_timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/v1/sync/batch
 * Process multiple transactions in a batch
 */
router.post('/sync/batch', async (req: Request, res: Response) => {
  try {
    const { transactions } = req.body;

    if (!Array.isArray(transactions)) {
      return res.status(400).json({
        success: false,
        error_code: 'INVALID_REQUEST',
        error_message: 'transactions must be an array'
      });
    }

    logger.info('Processing batch sync request', {
      count: transactions.length
    });

    const results = await Promise.all(
      transactions.map(async (syncRequest: SyncRequest) => {
        try {
          return await syncProcessor.processTransaction(syncRequest);
        } catch (error) {
          return {
            success: false,
            transaction_id: syncRequest.transaction.transaction_id,
            error_code: 'PROCESSING_ERROR',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            server_timestamp: new Date().toISOString()
          };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    res.json({
      success: failureCount === 0,
      total: results.length,
      succeeded: successCount,
      failed: failureCount,
      results,
      server_timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Batch sync request failed', { error });
    res.status(500).json({
      success: false,
      error_code: 'INTERNAL_ERROR',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      server_timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/sync/stats
 * Get sync statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await syncProcessor.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get sync stats', { error });
    res.status(500).json({
      error_code: 'INTERNAL_ERROR',
      error_message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
