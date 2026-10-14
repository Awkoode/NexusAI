import 'dotenv/config';
import { getEnv } from './config/env';
import { logger } from './utils/logger';
import { getRedisConnection, closeRedisConnection, checkRedis } from './queue/connection';
import { closeAnalyticsQueue } from './queue/analyticsQueue';
import { startWorker, stopWorker, recoverOrphanedJobs } from './queue/processor';

/**
 * Standalone BullMQ worker process.
 * Run separately from the HTTP server:
 *   npm run worker --workspace=apps/api
 */
async function main(): Promise<void> {
  const env = getEnv();

  if (!env.REDIS_URL) {
    logger.error('REDIS_URL is not configured; the worker cannot start without Redis');
    process.exit(1);
  }

  // Fail fast with a clear error when Redis is unreachable.
  const redis = getRedisConnection();
  try {
    await redis.ping();
  } catch (error) {
    logger.error(
      'Cannot reach Redis at the configured REDIS_URL — start Redis or fix the URL',
      {},
      error instanceof Error ? error : undefined
    );
    process.exit(1);
  }

  const health = await checkRedis();
  logger.info('Worker booting', {
    redisLatencyMs: health.latencyMs ?? -1,
    concurrency: env.WORKER_CONCURRENCY,
    maxAttempts: env.JOB_MAX_ATTEMPTS,
    backoffMs: env.JOB_BACKOFF_MS,
  });

  const recovered = await recoverOrphanedJobs().catch((error: unknown) => {
    logger.error('Recovery pass failed (worker continues)', {}, error instanceof Error ? error : undefined);
    return 0;
  });
  if (recovered > 0) {
    logger.info('Recovered orphaned jobs', { recovered });
  }

  startWorker();

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, draining worker`, {});
    const force = setTimeout(() => {
      logger.error('Worker shutdown timed out; forcing exit');
      process.exit(1);
    }, 30000);
    force.unref();
    try {
      await stopWorker();
      await closeAnalyticsQueue();
      await closeRedisConnection();
      logger.info('Worker shut down gracefully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during worker shutdown', {}, error instanceof Error ? error : undefined);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection in worker', {}, reason instanceof Error ? reason : new Error(String(reason)));
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception in worker', {}, error);
    process.exit(1);
  });
}

if (require.main === module) {
  main().catch((error: unknown) => {
    logger.error('Worker failed to start', {}, error instanceof Error ? error : undefined);
    process.exit(1);
  });
}
