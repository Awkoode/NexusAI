import { getEnv } from '../config/env';
import { logger } from '../utils/logger';

export interface MlTrainPayload {
  task_type: 'regression' | 'classification';
  model_type: string;
  target_column: string;
  feature_columns: string[];
  columns: string[];
  rows: string[][];
  test_size: number;
  random_state: number;
}

export interface MlTrainResult {
  task_type: 'regression' | 'classification';
  model_type: string;
  target_column: string;
  feature_columns: string[];
  test_size: number;
  random_state: number;
  metrics: Record<string, unknown>;
  predictions_summary: Record<string, unknown>;
  train_seconds: number;
  library_versions: Record<string, string>;
}

export class MlServiceError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 502) {
    super(message);
    this.name = 'MlServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** Health check against the internal ML service. */
export async function checkMlHealth(): Promise<{ ok: boolean; version?: string }> {
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${env.ML_SERVICE_URL}/health`, {
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false };
    const body = (await response.json()) as { version?: string };
    return { ok: true, version: body.version };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Send a training job to the internal ML service and await the result. */
export async function trainModel(payload: MlTrainPayload): Promise<MlTrainResult> {
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.ML_TIMEOUT_MS);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.ML_SERVICE_KEY) {
    headers['X-ML-Service-Key'] = env.ML_SERVICE_KEY;
  }

  let response: Response;
  try {
    response = await fetch(`${env.ML_SERVICE_URL}/train`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('ML service request timed out');
      throw new MlServiceError('ML_TIMEOUT', 'Training timed out', 504);
    }
    logger.error('ML service unreachable', {}, error instanceof Error ? error : undefined);
    throw new MlServiceError('ML_UNAVAILABLE', 'ML service is unavailable', 503);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = 'Training failed';
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === 'string' && body.detail) detail = body.detail;
    } catch {
      // keep generic message; never forward raw internals
    }
    if (response.status === 422) {
      throw new MlServiceError('ML_VALIDATION_ERROR', detail, 422);
    }
    if (response.status === 401 || response.status === 403) {
      logger.error('ML service rejected internal credentials');
      throw new MlServiceError('ML_AUTH_ERROR', 'ML service authentication failed', 500);
    }
    throw new MlServiceError('ML_ERROR', detail, 502);
  }

  return (await response.json()) as MlTrainResult;
}

export interface PythonColumnsPayload {
  columns: Record<string, (number | null)[]>;
}

/** Descriptive statistics from the Python service (comparison counterpart). */
export async function pythonDescribe(
  payload: PythonColumnsPayload
): Promise<Record<string, unknown>> {
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.ML_TIMEOUT_MS);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.ML_SERVICE_KEY) {
    headers['X-ML-Service-Key'] = env.ML_SERVICE_KEY;
  }

  let response: Response;
  try {
    response = await fetch(`${env.ML_SERVICE_URL}/statistics/describe`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new MlServiceError('ML_TIMEOUT', 'Statistics request timed out', 504);
    }
    throw new MlServiceError('ML_UNAVAILABLE', 'ML service is unavailable', 503);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new MlServiceError('ML_ERROR', 'Python statistics request failed', 502);
  }
  return (await response.json()) as Record<string, unknown>;
}

/** Correlation matrix from the Python service (comparison counterpart). */
export async function pythonCorrelation(
  payload: PythonColumnsPayload
): Promise<Record<string, unknown>> {
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.ML_TIMEOUT_MS);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.ML_SERVICE_KEY) {
    headers['X-ML-Service-Key'] = env.ML_SERVICE_KEY;
  }

  let response: Response;
  try {
    response = await fetch(`${env.ML_SERVICE_URL}/statistics/correlation`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new MlServiceError('ML_TIMEOUT', 'Statistics request timed out', 504);
    }
    throw new MlServiceError('ML_UNAVAILABLE', 'ML service is unavailable', 503);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new MlServiceError('ML_ERROR', 'Python statistics request failed', 502);
  }
  return (await response.json()) as Record<string, unknown>;
}

/** Covariance matrix from the Python service (comparison counterpart). */
export async function pythonCovariance(
  payload: PythonColumnsPayload
): Promise<Record<string, unknown>> {
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.ML_TIMEOUT_MS);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.ML_SERVICE_KEY) {
    headers['X-ML-Service-Key'] = env.ML_SERVICE_KEY;
  }

  let response: Response;
  try {
    response = await fetch(`${env.ML_SERVICE_URL}/statistics/covariance`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new MlServiceError('ML_TIMEOUT', 'Statistics request timed out', 504);
    }
    throw new MlServiceError('ML_UNAVAILABLE', 'ML service is unavailable', 503);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new MlServiceError('ML_ERROR', 'Python statistics request failed', 502);
  }
  return (await response.json()) as Record<string, unknown>;
}
