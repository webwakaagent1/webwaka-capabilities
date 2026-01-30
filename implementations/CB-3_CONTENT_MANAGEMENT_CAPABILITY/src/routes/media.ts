import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { mediaService } from '../services';
import { MediaType } from '../models/types';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.post('/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string || req.body.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const asset = await mediaService.uploadAsset(tenantId, req.file, {
      folderId: req.body.folderId,
      altText: req.body.altText,
      caption: req.body.caption,
    });

    res.status(201).json({ data: asset });
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
      mediaType: req.query.mediaType as MediaType | undefined,
      folderId: req.query.folderId as string | undefined,
      search: req.query.search as string | undefined,
    };

    const assets = await mediaService.listAssets(filter, limit, offset);
    res.json({ data: assets, limit, offset });
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

    const asset = await mediaService.getAsset(req.params.id, tenantId);
    if (!asset) {
      res.status(404).json({ error: 'Media asset not found' });
      return;
    }
    res.json({ data: asset });
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

    const asset = await mediaService.updateAsset(req.params.id, tenantId, req.body);
    if (!asset) {
      res.status(404).json({ error: 'Media asset not found' });
      return;
    }
    res.json({ data: asset });
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

    const deleted = await mediaService.deleteAsset(req.params.id, tenantId);
    if (!deleted) {
      res.status(404).json({ error: 'Media asset not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/folders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.body.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const { name, parentId } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const folder = await mediaService.createFolder(tenantId, name, parentId);
    res.status(201).json({ data: folder });
  } catch (err) {
    next(err);
  }
});

router.get('/folders/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const parentId = req.query.parentId as string | undefined;
    const folders = await mediaService.listFolders(tenantId, parentId);
    res.json({ data: folders });
  } catch (err) {
    next(err);
  }
});

router.delete('/folders/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    const deleted = await mediaService.deleteFolder(req.params.id, tenantId);
    if (!deleted) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
