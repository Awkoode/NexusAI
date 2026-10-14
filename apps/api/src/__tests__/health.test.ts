// Set test environment variables BEFORE any imports
process.env['NODE_ENV'] = 'test';
process.env['API_VERSION'] = 'v1';
process.env['PORT'] = '3001';
process.env['CORS_ORIGIN'] = 'http://localhost:3000';

import { createApp } from '../index';
import request from 'supertest';
import type { HealthCheckResponse, ReadinessResponse } from '@nexusai/shared';

// Mock the logger to avoid noise in tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

interface HealthResponseBody {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  checks?: HealthCheckResponse['checks'];
}

interface ReadyResponseBody {
  ready: boolean;
  service: string;
  version: string;
  timestamp: string;
  dependencies: ReadinessResponse['dependencies'];
}

interface ErrorResponseBody {
  success: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
  meta: { timestamp: string; requestId?: string; version: string };
}

describe('Health Endpoints', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /api/v1/health', () => {
    it('returns 200 with health status', async () => {
      const response = await request(app).get('/api/v1/health');
      const body = response.body as HealthResponseBody;

      expect(response.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(body.service).toBe('nexusai-api');
      expect(body.version).toBeDefined();
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(body.checks)).toBe(true);
    });

    it('includes API check in health response', async () => {
      const response = await request(app).get('/api/v1/health');
      const body = response.body as HealthResponseBody;

      const apiCheck = body.checks?.find((c) => c.name === 'api');
      expect(apiCheck).toBeDefined();
      expect(apiCheck?.status).toBe('pass');
      expect(apiCheck?.componentType).toBe('service');
    });
  });

  describe('GET /api/v1/health/ready', () => {
    it('returns 200 when ready', async () => {
      const response = await request(app).get('/api/v1/health/ready');
      const body = response.body as ReadyResponseBody;

      expect(response.status).toBe(200);
      expect(body.ready).toBe(true);
      expect(body.service).toBe('nexusai-api');
      expect(body.version).toBeDefined();
      expect(body.timestamp).toBeDefined();
      expect(Array.isArray(body.dependencies)).toBe(true);
    });

    it('includes database dependency check', async () => {
      const response = await request(app).get('/api/v1/health/ready');
      const body = response.body as ReadyResponseBody;

      const dbCheck = body.dependencies.find((d) => d.name === 'database');
      expect(dbCheck).toBeDefined();
      expect(dbCheck?.ready).toBe(true);
    });
  });

  describe('404 Handler', () => {
    it('returns 404 for unknown routes', async () => {
      const response = await request(app).get('/api/v1/unknown');
      const body = response.body as ErrorResponseBody;

      expect(response.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});