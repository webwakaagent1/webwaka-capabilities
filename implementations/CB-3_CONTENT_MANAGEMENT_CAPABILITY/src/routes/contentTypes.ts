import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { contentTypeService } from '../services';

const router = Router();

const fieldSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().valid('text', 'richtext', 'number', 'boolean', 'date', 'datetime', 'select', 'multiselect', 'media', 'reference', 'json').required(),
  label: Joi.string().required(),
  required: Joi.boolean().default(false),
  localized: Joi.boolean().default(false),
  options: Joi.array().items(Joi.string()).optional(),
  validations: Joi.object().optional(),
  defaultValue: Joi.any().optional(),
});

const createContentTypeSchema = Joi.object({
  tenantId: Joi.string().required(),
  name: Joi.string().required(),
  slug: Joi.string().required(),
  description: Joi.string().optional(),
  fields: Joi.array().items(fieldSchema).required(),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createContentTypeSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message });
      return;
    }

    const contentType = await contentTypeService.createContentType(value);
    res.status(201).json({ data: contentType });
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

    const contentTypes = await contentTypeService.listContentTypes(tenantId, limit, offset);
    res.json({ data: contentTypes, limit, offset });
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

    const contentType = await contentTypeService.getContentType(req.params.id, tenantId);
    if (!contentType) {
      res.status(404).json({ error: 'Content type not found' });
      return;
    }
    res.json({ data: contentType });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const updates = req.body;
    const contentType = await contentTypeService.updateContentType(req.params.id, tenantId, updates);
    if (!contentType) {
      res.status(404).json({ error: 'Content type not found' });
      return;
    }
    res.json({ data: contentType });
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

    const deleted = await contentTypeService.deleteContentType(req.params.id, tenantId);
    if (!deleted) {
      res.status(404).json({ error: 'Content type not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
