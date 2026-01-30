import { Router, Request, Response } from 'express';
import { ChannelService } from '../services/ChannelService';
import { EventService } from '../services/EventService';

const router = Router();
const channelService = new ChannelService();
const eventService = new EventService();

router.post('/', async (req: Request, res: Response) => {
  try {
    const performedBy = req.headers['x-user-id'] as string || 'system';
    const channel = await channelService.createChannel(req.body, performedBy);
    res.status(201).json(channel);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId, channelType, isActive } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const channels = await channelService.listChannels(tenantId as string, {
      channelType: channelType as 'ecommerce' | 'pos' | 'marketplace' | 'wholesale' | 'api',
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const channel = await channelService.getChannelById(tenantId as string, req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    res.json(channel);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const performedBy = req.headers['x-user-id'] as string || 'system';
    const channel = await channelService.updateChannel(tenantId, req.params.id, req.body, performedBy);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    res.json(channel);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/:channelId/subscriptions', async (req: Request, res: Response) => {
  try {
    const performedBy = req.headers['x-user-id'] as string || 'system';
    const subscription = await channelService.createSubscription({
      ...req.body,
      channelId: req.params.channelId,
    }, performedBy);
    res.status(201).json(subscription);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/:channelId/subscriptions', async (req: Request, res: Response) => {
  try {
    const { tenantId, productId, status } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const subscriptions = await channelService.listSubscriptions(tenantId as string, {
      channelId: req.params.channelId,
      productId: productId as string,
      status: status as 'active' | 'paused' | 'cancelled',
    });
    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.patch('/subscriptions/:id/status', async (req: Request, res: Response) => {
  try {
    const { tenantId, status } = req.body;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    if (!status) return res.status(400).json({ error: 'status is required' });
    
    const performedBy = req.headers['x-user-id'] as string || 'system';
    const subscription = await channelService.updateSubscriptionStatus(
      tenantId, req.params.id, status, performedBy
    );
    if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
    res.json(subscription);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.delete('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const performedBy = req.headers['x-user-id'] as string || 'system';
    const deleted = await channelService.deleteSubscription(tenantId as string, req.params.id, performedBy);
    if (!deleted) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/events', async (req: Request, res: Response) => {
  try {
    const { tenantId, eventType, productId, locationId, fromDate, toDate } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    
    const events = await eventService.getEvents(tenantId as string, {
      eventType: eventType as any,
      productId: productId as string,
      locationId: locationId as string,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
