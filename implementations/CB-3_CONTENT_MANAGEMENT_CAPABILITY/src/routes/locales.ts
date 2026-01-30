import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { localeService } from '../services';

const router = Router();

const createLocaleSchema = Joi.object({
  tenantId: Joi.string().required(),
  code: Joi.string().required(),
  name: Joi.string().required(),
  isDefault: Joi.boolean().default(false),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createLocaleSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message });
      return;
    }

    const locale = await localeService.createLocale(value.tenantId, value.code, value.name, value.isDefault);
    res.status(201).json({ data: locale });
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

    const activeOnly = req.query.activeOnly !== 'false';
    const locales = await localeService.listLocales(tenantId, activeOnly);
    res.json({ data: locales });
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

    const locale = await localeService.getDefaultLocale(tenantId);
    if (!locale) {
      res.status(404).json({ error: 'Default locale not found' });
      return;
    }
    res.json({ data: locale });
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

    const locale = await localeService.getLocale(req.params.id, tenantId);
    if (!locale) {
      res.status(404).json({ error: 'Locale not found' });
      return;
    }
    res.json({ data: locale });
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

    const locale = await localeService.updateLocale(req.params.id, tenantId, req.body);
    if (!locale) {
      res.status(404).json({ error: 'Locale not found' });
      return;
    }
    res.json({ data: locale });
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

    const deleted = await localeService.deleteLocale(req.params.id, tenantId);
    if (!deleted) {
      res.status(404).json({ error: 'Locale not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
