import IORedis from 'ioredis';
import { getEnv } from '../config/env';
import { logger } from '../utils/logger';

let redis: IORedis | null = null;
let warned = false;

/**
 * Shared Redis connection. BullMQ workers REQUIRE `maxRetriesPerRequest: null`
 * (blocking commands), so this connection is configured for queue use.
 */
export function getRedisConnection(): IORedis {
  if (redis) return redis;

  const env = getEnv();
  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is not configured');
  }

  redis = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  redis.on('error', (error: Error) => {
    // Rate-limit log spam on persistent outages.
    if (!warned) {
      warned = true;
      logger.error('Redis connection error', {}, error);
      setTimeout(() => {
        warned = false;
      }, 30000).unref();
    }
  });

  redis.on('connect', () => {
    logger.info('Redis connected');
  });

  return redis;
}

/** Lightweight health probe used by readiness checks (5s timeout). */
export async function checkRedis(): Promise<{ ok: boolean; latencyMs?: number }> {
  const env = getEnv();
  if (!env.REDIS_URL) {
    return { ok: false };
  }
  const start = Date.now();
  try {
    const client = getRedisConnection();
    const pong = await client.ping();
    if (pong !== 'PONG') return { ok: false };
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false };
  }
}

export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    redis.removeAllListeners();
    await redis.quit().catch(() => undefined);
    redis = null;
  }
}

/** Test-only hook. */
export function resetRedisConnection(): void {
  if (redis) {
    redis.removeAllListeners();
    void redis.disconnect();
    redis = null;
  }
}
