import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { workflowService } from '../services';

const router = Router();

const stepSchema = Joi.object({
  name: Joi.string().required(),
  status: Joi.string().valid('draft', 'in_review', 'approved', 'published', 'archived').required(),
  order: Joi.number().required(),
  requiredApprovers: Joi.number().optional(),
  autoTransition: Joi.boolean().optional(),
  notifyRoles: Joi.array().items(Joi.string()).optional(),
});

const createWorkflowSchema = Joi.object({
  tenantId: Joi.string().required(),
  name: Joi.string().required(),
  slug: Joi.string().required(),
  description: Joi.string().optional(),
  steps: Joi.array().items(stepSchema).min(2).required(),
  isDefault: Joi.boolean().default(false),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createWorkflowSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message });
      return;
    }

    const workflow = await workflowService.createWorkflowDefinition(
      value.tenantId,
      value.name,
      value.slug,
      value.steps,
      value.description,
      value.isDefault
    );
    res.status(201).json({ data: workflow });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const workflows = await workflowService.listWorkflowDefinitions(tenantId);
    res.json({ data: workflows });
  } catch (err) {
    next(err);
  }
});

router.get('/default', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const workflow = await workflowService.getDefaultWorkflow(tenantId);
    if (!workflow) {
      res.status(404).json({ error: 'Default workflow not found' });
      return;
    }
    res.json({ data: workflow });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const workflow = await workflowService.getWorkflowDefinition(req.params.id, tenantId);
    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    res.json({ data: workflow });
  } catch (err) {
    next(err);
  }
});

router.get('/instances/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const instance = await workflowService.getWorkflowInstance(req.params.id, tenantId);
    if (!instance) {
      res.status(404).json({ error: 'Workflow instance not found' });
      return;
    }
    res.json({ data: instance });
  } catch (err) {
    next(err);
  }
});

router.post('/instances/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const { approverId, approved, comment } = req.body;
    if (!approverId || approved === undefined) {
      res.status(400).json({ error: 'approverId and approved are required' });
      return;
    }

    const instance = await workflowService.approveStep(req.params.id, tenantId, approverId, approved, comment);
    if (!instance) {
      res.status(404).json({ error: 'Workflow instance not found' });
      return;
    }
    res.json({ data: instance, message: approved ? 'Step approved' : 'Step rejected' });
  } catch (err) {
    next(err);
  }
});

router.post('/instances/:id/comment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const { authorId, content } = req.body;
    if (!authorId || !content) {
      res.status(400).json({ error: 'authorId and content are required' });
      return;
    }

    const instance = await workflowService.addComment(req.params.id, tenantId, authorId, content);
    if (!instance) {
      res.status(404).json({ error: 'Workflow instance not found' });
      return;
    }
    res.json({ data: instance });
  } catch (err) {
    next(err);
  }
});

router.post('/instances/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const instance = await workflowService.cancelWorkflow(req.params.id, tenantId);
    if (!instance) {
      res.status(404).json({ error: 'Workflow instance not found or already completed' });
      return;
    }
    res.json({ data: instance, message: 'Workflow cancelled' });
  } catch (err) {
    next(err);
  }
});

export default router;
