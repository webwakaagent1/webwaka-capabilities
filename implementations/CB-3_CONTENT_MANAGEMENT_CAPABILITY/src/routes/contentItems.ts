import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { contentItemService, workflowService } from '../services';
import { ContentStatus } from '../models/types';

const router = Router();

const createContentItemSchema = Joi.object({
  tenantId: Joi.string().required(),
  contentTypeId: Joi.string().uuid().required(),
  slug: Joi.string().required(),
  title: Joi.string().required(),
  data: Joi.object().required(),
  authorId: Joi.string().required(),
  localizedData: Joi.object().optional(),
});

const updateContentItemSchema = Joi.object({
  title: Joi.string().optional(),
  slug: Joi.string().optional(),
  data: Joi.object().optional(),
  localizedData: Joi.object().optional(),
  changeLog: Joi.string().optional(),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createContentItemSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message });
      return;
    }

    const contentItem = await contentItemService.createContentItem(value);
    res.status(201).json({ data: contentItem });
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

    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const filter = {
      tenantId,
      contentTypeId: req.query.contentTypeId as string | undefined,
      status: req.query.status as ContentStatus | undefined,
      authorId: req.query.authorId as string | undefined,
      search: req.query.search as string | undefined,
    };

    const contentItems = await contentItemService.listContentItems(filter, limit, offset);
    res.json({ data: contentItems, limit, offset });
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

    const contentItem = await contentItemService.getContentItem(req.params.id, tenantId);
    if (!contentItem) {
      res.status(404).json({ error: 'Content item not found' });
      return;
    }
    res.json({ data: contentItem });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    const authorId = req.query.authorId as string;
    if (!tenantId || !authorId) {
      res.status(400).json({ error: 'tenantId and authorId are required' });
      return;
    }

    const { error, value } = updateContentItemSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message });
      return;
    }

    const contentItem = await contentItemService.updateContentItem(req.params.id, tenantId, value, authorId);
    if (!contentItem) {
      res.status(404).json({ error: 'Content item not found' });
      return;
    }
    res.json({ data: contentItem });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const contentItem = await contentItemService.updateStatus(req.params.id, tenantId, 'published');
    if (!contentItem) {
      res.status(404).json({ error: 'Content item not found' });
      return;
    }
    res.json({ data: contentItem, message: 'Content published' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const contentItem = await contentItemService.updateStatus(req.params.id, tenantId, 'archived');
    if (!contentItem) {
      res.status(404).json({ error: 'Content item not found' });
      return;
    }
    res.json({ data: contentItem, message: 'Content archived' });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const versions = await contentItemService.getVersions(req.params.id, tenantId);
    res.json({ data: versions });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/rollback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    const authorId = req.query.authorId as string;
    if (!tenantId || !authorId) {
      res.status(400).json({ error: 'tenantId and authorId are required' });
      return;
    }

    const { version } = req.body;
    if (!version || typeof version !== 'number') {
      res.status(400).json({ error: 'version (number) is required' });
      return;
    }

    const contentItem = await contentItemService.rollbackToVersion(req.params.id, tenantId, version, authorId);
    if (!contentItem) {
      res.status(404).json({ error: 'Content item not found' });
      return;
    }
    res.json({ data: contentItem, message: `Rolled back to version ${version}` });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/workflow/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const { workflowDefinitionId, assignedTo } = req.body;
    const workflow = await workflowService.startWorkflow(tenantId, req.params.id, workflowDefinitionId, assignedTo);
    res.status(201).json({ data: workflow, message: 'Workflow started' });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/workflow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const workflow = await workflowService.getActiveWorkflowForContent(req.params.id, tenantId);
    if (!workflow) {
      res.status(404).json({ error: 'No active workflow found' });
      return;
    }
    res.json({ data: workflow });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const deleted = await contentItemService.deleteContentItem(req.params.id, tenantId);
    if (!deleted) {
      res.status(404).json({ error: 'Content item not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
