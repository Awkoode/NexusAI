import type { HealthCheckResponse, ReadinessResponse, ApiResponse, ApiError } from '../index';

describe('Shared Types', () => {
  describe('HealthCheckResponse', () => {
    it('should match expected structure', () => {
      const response: HealthCheckResponse = {
        status: 'ok',
        service: 'test-service',
        version: 'v1',
        timestamp: new Date().toISOString(),
        uptime: 100,
        checks: [
          { name: 'api', status: 'pass', componentType: 'service' },
        ],
      };

      expect(response.status).toBe('ok');
      expect(response.service).toBe('test-service');
      expect(response.checks).toHaveLength(1);
    });

    it('should allow degraded status', () => {
      const response: HealthCheckResponse = {
        status: 'degraded',
        service: 'test-service',
        version: 'v1',
        timestamp: new Date().toISOString(),
        uptime: 100,
      };

      expect(response.status).toBe('degraded');
    });
  });

  describe('ReadinessResponse', () => {
    it('should match expected structure', () => {
      const response: ReadinessResponse = {
        ready: true,
        service: 'test-service',
        version: 'v1',
        timestamp: new Date().toISOString(),
        dependencies: [
          { name: 'database', ready: true, latencyMs: 5 },
        ],
      };

      expect(response.ready).toBe(true);
      expect(response.dependencies).toHaveLength(1);
    });
  });

  describe('ApiResponse', () => {
    it('should match success structure', () => {
      const response: ApiResponse<{ id: string }> = {
        success: true,
        data: { id: '123' },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: 'req-123',
          version: 'v1',
        },
      };

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: '123' });
    });

    it('should match error structure', () => {
      const error: ApiError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'email' },
      };

      const response: ApiResponse = {
        success: false,
        error,
        meta: {
          timestamp: new Date().toISOString(),
          version: 'v1',
        },
      };

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('VALIDATION_ERROR');
    });
  });
});