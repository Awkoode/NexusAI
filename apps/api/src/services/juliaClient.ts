import { getEnv } from '../config/env';
import { logger } from '../utils/logger';

export interface JuliaColumnsPayload {
  columns: Record<string, (number | null)[]>;
  options?: { missing_policy?: 'pairwise' | 'listwise' };
}

export class JuliaServiceError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 502) {
    super(message);
    this.name = 'JuliaServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function serviceHeaders(): Record<string, string> {
  const env = getEnv();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.JULIA_SERVICE_KEY) {
    headers['X-Julia-Service-Key'] = env.JULIA_SERVICE_KEY;
  }
  return headers;
}

async function postJulia<T>(path: string, body: unknown): Promise<T> {
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.JULIA_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${env.JULIA_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: serviceHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('Julia service request timed out');
      throw new JuliaServiceError('JULIA_TIMEOUT', 'Analysis timed out', 504);
    }
    logger.error('Julia service unreachable', {}, error instanceof Error ? error : undefined);
    throw new JuliaServiceError('JULIA_UNAVAILABLE', 'Statistics service is unavailable', 503);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = 'Analysis failed';
    try {
      const parsed = (await response.json()) as { error?: { message?: unknown } };
      if (typeof parsed.error?.message === 'string' && parsed.error.message) {
        detail = parsed.error.message;
      }
    } catch {
      // keep generic message; never forward raw internals
    }
    if (response.status === 422) {
      throw new JuliaServiceError('JULIA_VALIDATION_ERROR', detail, 422);
    }
    if (response.status === 401 || response.status === 403) {
      logger.error('Julia service rejected internal credentials');
      throw new JuliaServiceError('JULIA_AUTH_ERROR', 'Statistics service authentication failed', 500);
    }
    throw new JuliaServiceError('JULIA_ERROR', detail, 502);
  }

  return (await response.json()) as T;
}

/** Health check against the internal Julia service. */
export async function checkJuliaHealth(): Promise<{ ok: boolean; version?: string; julia?: string }> {
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${env.JULIA_SERVICE_URL}/health`, {
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false };
    const body = (await response.json()) as { version?: string; julia?: string };
    return { ok: true, version: body.version, julia: body.julia };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function juliaDescribe(payload: JuliaColumnsPayload): Promise<Record<string, unknown>> {
  return postJulia('/v1/statistics/describe', payload);
}

export async function juliaCorrelation(payload: JuliaColumnsPayload): Promise<Record<string, unknown>> {
  return postJulia('/v1/statistics/correlation', payload);
}

export async function juliaCovariance(payload: JuliaColumnsPayload): Promise<Record<string, unknown>> {
  return postJulia('/v1/statistics/covariance', payload);
}

export async function juliaLinearAlgebra(matrix: number[][]): Promise<Record<string, unknown>> {
  return postJulia('/v1/linear-algebra/analyze', { matrix });
}
