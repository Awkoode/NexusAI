import { z } from 'zod';
import type { ValidatedEnv } from '@nexusai/shared';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().url().optional(),
  API_VERSION: z.string().default('v1'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  STORAGE_DRIVER: z.enum(['local', 'supabase']).default('local'),
  STORAGE_BUCKET: z.string().min(1).default('datasets'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(100).default(10),
  ML_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  ML_SERVICE_KEY: z.string().min(1).optional(),
  ML_TIMEOUT_MS: z.coerce.number().int().positive().max(600000).default(120000),
  JULIA_SERVICE_URL: z.string().url().default('http://localhost:8001'),
  JULIA_SERVICE_KEY: z.string().min(1).optional(),
  JULIA_TIMEOUT_MS: z.coerce.number().int().positive().max(600000).default(60000),
  REDIS_URL: z.string().url().optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(2),
  JOB_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  JOB_BACKOFF_MS: z.coerce.number().int().min(100).max(600000).default(5000),
});

let validatedEnv: ValidatedEnv | null = null;

export function validateEnv(): ValidatedEnv {
  if (validatedEnv) {
    return validatedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const messages = Object.entries(errors)
      .map(([field, errs]) => `${field}: ${errs.join(', ')}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${messages}`);
  }

  validatedEnv = result.data as ValidatedEnv;
  return validatedEnv;
}

export function getEnv(): ValidatedEnv {
  if (!validatedEnv) {
    return validateEnv();
  }
  return validatedEnv;
}

export function resetEnvCache(): void {
  validatedEnv = null;
}