import { Router, Request, Response } from 'express';
import { InventoryService } from '../services/InventoryService';

const router = Router();
const inventoryService = new InventoryService();

router.get('/stock', async (req: Request, res: Response) => {
  try {
    const { tenantId, productId, locationId } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const stockLevels = await inventoryService.getStockLevels(tenantId as string, {
      productId: productId as string,
      locationId: locationId as string,
    });
    res.json(stockLevels);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/stock/:productId/:locationId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const stockLevel = await inventoryService.getStockLevel(
      tenantId as string, req.params.productId, req.params.locationId
    );
    if (!stockLevel) return res.status(404).json({ error: 'Stock level not found' });
    res.json(stockLevel);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/receive', async (req: Request, res: Response) => {
  try {
    const result = await inventoryService.receiveStock(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/sell', async (req: Request, res: Response) => {
  try {
    const result = await inventoryService.sellStock(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/adjust', async (req: Request, res: Response) => {
  try {
    const result = await inventoryService.adjustStock(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/movements', async (req: Request, res: Response) => {
  try {
    const { tenantId, productId, locationId, movementType, fromDate, toDate } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const movements = await inventoryService.getMovements(tenantId as string, {
      productId: productId as string,
      locationId: locationId as string,
      movementType: movementType as string,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
    });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/transfers', async (req: Request, res: Response) => {
  try {
    const transfer = await inventoryService.createTransfer(req.body);
    res.status(201).json(transfer);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/transfers', async (req: Request, res: Response) => {
  try {
    const { tenantId, status, productId } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const transfers = await inventoryService.getTransfers(tenantId as string, {
      status: status as string,
      productId: productId as string,
    });
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/transfers/:id/complete', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const performedBy = req.headers['x-user-id'] as string || 'system';
    const transfer = await inventoryService.completeTransfer(tenantId, req.params.id, performedBy);
    res.json(transfer);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/reservations', async (req: Request, res: Response) => {
  try {
    const reservation = await inventoryService.createReservation(req.body);
    res.status(201).json(reservation);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/reservations', async (req: Request, res: Response) => {
  try {
    const { tenantId, status, productId, channelId } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const reservations = await inventoryService.getReservations(tenantId as string, {
      status: status as string,
      productId: productId as string,
      channelId: channelId as string,
    });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/reservations/:id/fulfill', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const performedBy = req.headers['x-user-id'] as string || 'system';
    const reservation = await inventoryService.fulfillReservation(tenantId, req.params.id, performedBy);
    res.json(reservation);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/reservations/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const performedBy = req.headers['x-user-id'] as string || 'system';
    const reservation = await inventoryService.cancelReservation(tenantId, req.params.id, performedBy);
    res.json(reservation);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
