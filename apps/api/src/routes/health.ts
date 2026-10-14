import type { Request, Response } from 'express';
import { Router } from 'express';
import type { HealthCheckResponse, ReadinessResponse, DependencyCheck } from '@nexusai/shared';
import { getEnv } from '../config/env';
import { checkRedis } from '../queue/connection';

const router = Router();

const startTime = Date.now();
const API_VERSION = process.env['API_VERSION'] ?? 'v1';

function getUptime(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

/** Redis probe with a hard timeout so readiness never hangs. */
async function checkRedisWithTimeout(): Promise<DependencyCheck> {
  const timeout = new Promise<{ ok: false }>((resolve) => {
    const t = setTimeout(() => resolve({ ok: false as const }), 4000);
    t.unref();
  });
  const probed = await Promise.race([checkRedis(), timeout]);
  if (probed.ok) {
    return {
      name: 'redis',
      ready: true,
      latencyMs: probed.latencyMs,
    };
  }
  return {
    name: 'redis',
    ready: false,
    error: 'Redis unreachable (job queue unavailable)',
  };
}

function checkDatabase(): DependencyCheck {
  const env = getEnv();

  if (!env.DATABASE_URL) {
    return {
      name: 'database',
      ready: true,
      error: 'Not configured (optional in development)',
    };
  }
  const start = Date.now();
  try {
    // In a real implementation, you would test the actual database connection
    // For now, we just simulate a check since DATABASE_URL might not be set
    return {
      name: 'database',
      ready: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'database',
      ready: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// GET /api/v1/health - Liveness probe
router.get('/', (_req: Request, res: Response): void => {
  const response: HealthCheckResponse = {
    status: 'ok',
    service: 'nexusai-api',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    uptime: getUptime(),
    checks: [
      {
        name: 'api',
        status: 'pass',
        componentType: 'service',
        observedValue: getUptime(),
        observedUnit: 's',
      },
    ],
  };

  res.json(response);
});

// GET /api/v1/health/ready - Readiness probe
router.get('/ready', (_req: Request, res: Response): void => {
  const env = getEnv();
  const dependencies = [checkDatabase()];

  if (!env.REDIS_URL) {
    // Queue endpoints require Redis; without it the API still serves
    // everything else, so report it explicitly instead of failing.
    dependencies.push({
      name: 'redis',
      ready: true,
      error: 'Not configured (job queue endpoints return 503)',
    });
    const allReady = dependencies.every((d: DependencyCheck) => d.ready);
    const response: ReadinessResponse = {
      ready: allReady,
      service: 'nexusai-api',
      version: API_VERSION,
      timestamp: new Date().toISOString(),
      dependencies,
    };
    res.status(allReady ? 200 : 503).json(response);
    return;
  }

  void checkRedisWithTimeout().then((redis) => {
    dependencies.push(redis);
    const allReady = dependencies.every((d: DependencyCheck) => d.ready);
    const response: ReadinessResponse = {
      ready: allReady,
      service: 'nexusai-api',
      version: API_VERSION,
      timestamp: new Date().toISOString(),
      dependencies,
    };
    res.status(allReady ? 200 : 503).json(response);
  });
});

export default router;