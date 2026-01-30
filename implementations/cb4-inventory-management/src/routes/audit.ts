import { Router, Request, Response } from 'express';
import { AuditService } from '../services/AuditService';

const router = Router();
const auditService = new AuditService();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId, entityType, entityId, action, performedBy, fromDate, toDate } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const logs = await auditService.search(tenantId as string, {
      entityType: entityType as string,
      entityId: entityId as string,
      action: action as string,
      performedBy: performedBy as string,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const logs = await auditService.getEntityHistory(
      tenantId as string, req.params.entityType, req.params.entityId
    );
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
