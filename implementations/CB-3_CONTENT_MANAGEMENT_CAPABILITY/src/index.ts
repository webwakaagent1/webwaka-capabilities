import express, { Request, Response, NextFunction } from 'express';
import { pool } from './config/database';
import { logger } from './utils/logger';
import contentTypesRouter from './routes/contentTypes';
import contentItemsRouter from './routes/contentItems';
import mediaRouter from './routes/media';
import localesRouter from './routes/locales';
import workflowsRouter from './routes/workflows';
import * as fs from 'fs';
import * as path from 'path';

const app = express();
const PORT = parseInt(process.env.CB3_PORT || '5001', 10);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

app.get('/', (req, res) => {
  res.json({
    service: 'WebWaka CB-3 Content Management Capability',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      contentTypes: '/api/v1/content-types',
      contentItems: '/api/v1/content',
      media: '/api/v1/media',
      locales: '/api/v1/locales',
      workflows: '/api/v1/workflows',
    },
  });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

app.use('/api/v1/content-types', contentTypesRouter);
app.use('/api/v1/content', contentItemsRouter);
app.use('/api/v1/media', mediaRouter);
app.use('/api/v1/locales', localesRouter);
app.use('/api/v1/workflows', workflowsRouter);

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
app.use('/media', express.static(UPLOAD_DIR));

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: err.message || 'Internal server error' });
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    const migrationPath = path.join(__dirname, '..', 'migrations', '001_initial_schema.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await client.query(sql);
      logger.info('Database migrations applied');
    }
  } catch (error: any) {
    if (!error.message?.includes('already exists')) {
      logger.error('Migration error', { error: error.message });
    }
  } finally {
    client.release();
  }
}

async function startServer() {
  try {
    logger.info('Starting WebWaka CB-3 Content Management Capability...');
    
    const testResult = await pool.query('SELECT NOW()');
    logger.info('Database connection established');
    
    await runMigrations();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running at http://0.0.0.0:${PORT}`);
      logger.info('Available endpoints:');
      logger.info('  GET /              - API info');
      logger.info('  GET /health        - Health check');
      logger.info('  /api/v1/content-types - Content type management');
      logger.info('  /api/v1/content    - Content item management');
      logger.info('  /api/v1/media      - Media asset management');
      logger.info('  /api/v1/locales    - Locale management');
      logger.info('  /api/v1/workflows  - Workflow management');
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();

export { app };
