import { Router, Request, Response } from 'express';
import { LocationService } from '../services/LocationService';

const router = Router();
const locationService = new LocationService();

router.post('/', async (req: Request, res: Response) => {
  try {
    const performedBy = req.headers['x-user-id'] as string || 'system';
    const location = await locationService.create(req.body, performedBy);
    res.status(201).json(location);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId, locationType, isActive, parentLocationId } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const locations = await locationService.list(tenantId as string, {
      locationType: locationType as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      parentLocationId: parentLocationId as string,
    });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const location = await locationService.getById(tenantId as string, req.params.id);
    if (!location) return res.status(404).json({ error: 'Location not found' });
    res.json(location);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const performedBy = req.headers['x-user-id'] as string || 'system';
    const location = await locationService.update(tenantId, req.params.id, req.body, performedBy);
    if (!location) return res.status(404).json({ error: 'Location not found' });
    res.json(location);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
