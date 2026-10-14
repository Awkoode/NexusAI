// Set required env vars BEFORE importing anything
process.env['NODE_ENV'] = 'test';
process.env['API_VERSION'] = 'v1';
process.env['PORT'] = '3001';
process.env['CORS_ORIGIN'] = 'http://localhost:3000';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
process.env['MAX_UPLOAD_MB'] = '10';
process.env['REDIS_URL'] = 'redis://127.0.0.1:6380';

import { createApp } from '../index';
import request from 'supertest';
import { resetEnvCache } from '../config/env';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockGetUser = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ auth: { getUser: mockGetUser } })),
}));

jest.mock('../repositories/projects', () => ({
  getPool: jest.fn(),
  listProjects: jest.fn(),
  getProject: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
}));

jest.mock('../repositories/datasets', () => ({
  listDatasets: jest.fn(),
  getDataset: jest.fn(),
  createDataset: jest.fn(),
  markDatasetReady: jest.fn(),
  markDatasetFailed: jest.fn(),
  deleteDataset: jest.fn(),
  getDatasetStoragePath: jest.fn(),
}));

jest.mock('../repositories/jobs', () => ({
  createJob: jest.fn(),
  getJob: jest.fn(),
  getOwnedJob: jest.fn(),
  listOwnedJobs: jest.fn(),
  markJobActive: jest.fn(),
  updateJobProgress: jest.fn(),
  markJobCompleted: jest.fn(),
  markJobFailed: jest.fn(),
  markJobCancelled: jest.fn(),
  requestJobCancel: jest.fn(),
  findOrphanedActive: jest.fn(),
  requeueJob: jest.fn(),
}));

jest.mock('../repositories/experiments', () => ({
  listExperimentsByProject: jest.fn(),
  getExperiment: jest.fn(),
  createExperiment: jest.fn(),
  markExperimentRunning: jest.fn(),
  markExperimentCompleted: jest.fn(),
  markExperimentFailed: jest.fn(),
  deleteExperiment: jest.fn(),
  createRun: jest.fn(),
  completeRun: jest.fn(),
  failRun: jest.fn(),
  getLatestRun: jest.fn(),
  listRuns: jest.fn(),
}));

jest.mock('../repositories/analyses', () => ({
  listAnalysesByProject: jest.fn(),
  getAnalysis: jest.fn(),
  createAnalysis: jest.fn(),
  completeAnalysis: jest.fn(),
  failAnalysis: jest.fn(),
  deleteAnalysis: jest.fn(),
}));

jest.mock('../queue/analyticsQueue', () => ({
  ANALYTICS_QUEUE_NAME: 'nexusai-analytics',
  bullmqJobIdFor: (id: string) => `job:${id}`,
  enqueueAnalyticsJob: jest.fn(),
  removeQueuedJob: jest.fn(),
  getAnalyticsQueue: jest.fn(),
  closeAnalyticsQueue: jest.fn(),
  resetAnalyticsQueue: jest.fn(),
}));

import * as projectRepo from '../repositories/projects';
import * as datasetRepo from '../repositories/datasets';
import * as jobsRepo from '../repositories/jobs';
import { enqueueAnalyticsJob, removeQueuedJob } from '../queue/analyticsQueue';

function getBody(response: request.Response): Record<string, unknown> {
  return response.body as Record<string, unknown>;
}

describe('Jobs Endpoints', () => {
  let app: ReturnType<typeof createApp>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    user_metadata: {},
  };
  const projectId = '223e4567-e89b-12d3-a456-426614174000';
  const datasetId = '323e4567-e89b-12d3-a456-426614174000';
  const jobId = '623e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['REDIS_URL'] = 'redis://127.0.0.1:6380';
    resetEnvCache();
    app = createApp();
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    (projectRepo.getProject as jest.Mock).mockResolvedValue({ id: projectId, name: 'P' });
    (datasetRepo.getDataset as jest.Mock).mockResolvedValue({
      id: datasetId,
      projectId,
      storagePath: 'k',
      status: 'ready',
    });
  });

  describe('POST /api/v1/jobs', () => {
    it('rejects unauthenticated creation with 401', async () => {
      const response = await request(app)
        .post('/api/v1/jobs')
        .send({ jobType: 'dataset.profile', projectId, datasetId });
      expect(response.status).toBe(401);
    });

    it('rejects invalid job type with 400', async () => {
      const response = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', 'Bearer valid-token')
        .send({ jobType: 'ml.fly-to-the-moon', projectId, datasetId });
      expect(response.status).toBe(400);
    });

    it('returns 503 when Redis is not configured', async () => {
      delete process.env['REDIS_URL'];
      resetEnvCache();
      app = createApp();
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      try {
        const response = await request(app)
          .post('/api/v1/jobs')
          .set('Authorization', 'Bearer valid-token')
          .send({ jobType: 'dataset.profile', projectId, datasetId });
        expect(response.status).toBe(503);
        expect(getBody(response)['error']).toBeDefined();
      } finally {
        process.env['REDIS_URL'] = 'redis://127.0.0.1:6380';
        resetEnvCache();
        app = createApp();
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      }
    });

    it('creates a job and returns 202 with a pollable state', async () => {
      (jobsRepo.createJob as jest.Mock).mockResolvedValue({ id: jobId, status: 'queued' });
      (jobsRepo.getJob as jest.Mock).mockResolvedValue({ id: jobId, status: 'queued' });
      (enqueueAnalyticsJob as jest.Mock).mockResolvedValue(`job:${jobId}`);

      const response = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', 'Bearer valid-token')
        .send({ jobType: 'dataset.profile', projectId, datasetId });

      expect(enqueueAnalyticsJob) // eslint-disable-line
      expect(response.status).toBe(202);
      expect(getBody(response)['success']).toBe(true);
      // Payload carries identifiers only — no file contents or tokens.
      const calls = (enqueueAnalyticsJob as jest.Mock).mock.calls as unknown[][];
      const enqueued = calls[0]!;
      expect(enqueued[1]).toBe('dataset.profile');
    });

    it('rejects jobs for foreign projects with 404', async () => {
      (projectRepo.getProject as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', 'Bearer valid-token')
        .send({ jobType: 'dataset.profile', projectId, datasetId });

      expect(response.status).toBe(404);
      expect(enqueueAnalyticsJob).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/jobs', () => {
    it('lists own jobs with pagination metadata', async () => {
      (jobsRepo.listOwnedJobs as jest.Mock).mockResolvedValue({ jobs: [{ id: jobId }], total: 1 });
      const response = await request(app)
        .get('/api/v1/jobs?page=1&limit=20')
        .set('Authorization', 'Bearer valid-token');
      expect(response.status).toBe(200);
      const data = getBody(response)['data'] as Record<string, unknown>;
      expect(data['total']).toBe(1);
      expect(data['page']).toBe(1);
    });
  });

  describe('GET /api/v1/jobs/:jobId', () => {
    it('hides other users jobs with 404', async () => {
      (jobsRepo.getOwnedJob as jest.Mock).mockResolvedValue(null);
      const response = await request(app)
        .get(`/api/v1/jobs/${jobId}`)
        .set('Authorization', 'Bearer valid-token');
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/jobs/:jobId/cancel', () => {
    it('cancels a queued job directly', async () => {
      (jobsRepo.getOwnedJob as jest.Mock)
        .mockResolvedValueOnce({ id: jobId, status: 'queued', bullmqJobId: `job:${jobId}` })
        .mockResolvedValueOnce({ id: jobId, status: 'cancelled' });
      (removeQueuedJob as jest.Mock).mockResolvedValue(true);
      (jobsRepo.markJobCancelled as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post(`/api/v1/jobs/${jobId}/cancel`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(removeQueuedJob).toHaveBeenCalledWith(`job:${jobId}`);
    });

    it('requests cooperative cancel for active jobs', async () => {
      (jobsRepo.getOwnedJob as jest.Mock)
        .mockResolvedValueOnce({ id: jobId, status: 'active', bullmqJobId: `job:${jobId}` })
        .mockResolvedValueOnce({ id: jobId, status: 'cancel_requested' });
      (jobsRepo.requestJobCancel as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post(`/api/v1/jobs/${jobId}/cancel`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(removeQueuedJob).not.toHaveBeenCalled();
    });

    it('refuses to cancel terminal jobs', async () => {
      (jobsRepo.getOwnedJob as jest.Mock).mockResolvedValue({ id: jobId, status: 'completed' });
      const response = await request(app)
        .post(`/api/v1/jobs/${jobId}/cancel`)
        .set('Authorization', 'Bearer valid-token');
      expect(response.status).toBe(400);
    });
  });
});
