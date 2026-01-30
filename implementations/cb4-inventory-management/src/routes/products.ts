import { Router, Request, Response } from 'express';
import { ProductService } from '../services/ProductService';

const router = Router();
const productService = new ProductService();

router.post('/', async (req: Request, res: Response) => {
  try {
    const performedBy = req.headers['x-user-id'] as string || 'system';
    const product = await productService.create(req.body, performedBy);
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId, category, isActive, trackInventory } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const products = await productService.list(tenantId as string, {
      category: category as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      trackInventory: trackInventory === 'true' ? true : trackInventory === 'false' ? false : undefined,
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const product = await productService.getById(tenantId as string, req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/sku/:sku', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const product = await productService.getBySku(tenantId as string, req.params.sku);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const performedBy = req.headers['x-user-id'] as string || 'system';
    const product = await productService.update(tenantId, req.params.id, req.body, performedBy);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const performedBy = req.headers['x-user-id'] as string || 'system';
    const deleted = await productService.delete(tenantId as string, req.params.id, performedBy);
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
