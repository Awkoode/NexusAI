import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { validateEnv, getEnv } from './config/env';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler, requestIdMiddleware } from './middleware/errorHandler';
import healthRouter from './routes/health';
import projectsRouter from './routes/projects';
import datasetsRouter from './routes/datasets';
import experimentsRouter from './routes/experiments';
import analysesRouter from './routes/analyses';
import jobsRouter from './routes/jobs';

function createApp(): express.Application {
  validateEnv();
  const env = getEnv();

  const app = express();

  // Trust proxy for proper IP handling behind reverse proxies
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false,
  }));

  // CORS
  app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }));

  // Request ID middleware
  app.use(requestIdMiddleware);

  // Body parsing with size limit
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Request logging (development only)
  if (env.NODE_ENV !== 'production') {
    app.use((req, _res, next) => {
      logger.debug(`${req.method} ${req.path}`, { query: req.query });
      next();
    });
  }

  // API routes
  const apiPrefix = `/api/${env.API_VERSION}`;
  app.use(`${apiPrefix}/health`, healthRouter);
  app.use(`${apiPrefix}/projects`, projectsRouter);
  app.use(`/api/${env.API_VERSION}`, datasetsRouter);
  app.use(`/api/${env.API_VERSION}`, experimentsRouter);
  app.use(`/api/${env.API_VERSION}`, analysesRouter);
  app.use(`/api/${env.API_VERSION}`, jobsRouter);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
}

function startServer(): void {
  const env = getEnv();
  const app = createApp();

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`NexusAI API started`, {
      port: env.PORT,
      env: env.NODE_ENV,
      version: env.API_VERSION,
      corsOrigin: env.CORS_ORIGIN,
    });
    console.log(`>>> Server listening on port ${env.PORT}`);
  });

  server.on('error', (err) => {
    console.error('>>> Server error:', err);
    logger.error('Server error', {}, err);
  });

  server.on('listening', () => {
    console.log('>>> Server listening event fired');
    const addr = server.address();
    console.log('>>> Server address:', addr);
  });

  server.on('close', () => {
    console.log('>>> Server CLOSED');
  });

  // Keep process alive
  setInterval(() => {
    console.log('>>> Heartbeat:', new Date().toISOString());
  }, 10000);

  // Graceful shutdown
  const shutdown = (signal: string): void => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', {}, reason instanceof Error ? reason : new Error(String(reason)));
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {}, error);
    process.exit(1);
  });
}

// Only start server if this file is run directly
// Using require.main === module for CommonJS compatibility
if (require.main === module) {
  startServer();
}

export { createApp };