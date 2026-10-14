// Integration tests against a REAL Redis + REAL BullMQ queue/worker.
// DB repositories, storage, and Python/Julia clients are faked in-memory.
//
// Run (PowerShell):  $env:RUN_QUEUE_INTEGRATION='1'; npm run test:integration --workspace=apps/api
// Run (bash):        RUN_QUEUE_INTEGRATION=1 npm run test:integration --workspace=apps/api
// Needs: redis-server on 127.0.0.1:6380 (see README "Redis local").
//
// Set required env vars BEFORE importing anything
process.env['NODE_ENV'] = 'test';
process.env['API_VERSION'] = 'v1';
process.env['PORT'] = '3001';
process.env['CORS_ORIGIN'] = 'http://localhost:3000';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
process.env['MAX_UPLOAD_MB'] = '10';
process.env['REDIS_URL'] = 'redis://127.0.0.1:6380';
process.env['WORKER_CONCURRENCY'] = '2';
process.env['JOB_MAX_ATTEMPTS'] = '4';
process.env['JOB_BACKOFF_MS'] = '100';

import { randomUUID } from 'node:crypto';
import { UnrecoverableError } from 'bullmq';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

type MockJobRow = Record<string, unknown>;
const mockJobRows = new Map<string, MockJobRow>();

function cloneRow(row: MockJobRow): MockJobRow {
  return { ...row };
}

jest.mock('../repositories/jobs', () => ({
  createJob: jest.fn((data: Record<string, unknown>): Promise<MockJobRow> => {
    const row: MockJobRow = {
      id: randomUUID(),
      userId: data['userId'],
      projectId: data['projectId'] ?? null,
      datasetId: data['datasetId'] ?? null,
      jobType: data['jobType'],
      status: 'queued',
      params: JSON.parse(JSON.stringify(data['params'] ?? {})) as Record<string, unknown>,
      progress: 0,
      attempts: 0,
      maxAttempts: 2,
      bullmqJobId: data['bullmqJobId'],
      createdAt: new Date().toISOString(),
    };
    mockJobRows.set(row['id'] as string, row);
    return Promise.resolve(cloneRow(row));
  }),
  getJob: jest.fn((id: string): Promise<MockJobRow | null> => {
    const row = mockJobRows.get(id);
    return Promise.resolve(row ? cloneRow(row) : null);
  }),
  getOwnedJob: jest.fn((userId: string, id: string): Promise<MockJobRow | null> => {
    const row = mockJobRows.get(id);
    if (!row || row['userId'] !== userId) return Promise.resolve(null);
    return Promise.resolve(cloneRow(row));
  }),
  markJobActive: jest.fn((id: string): Promise<void> => {
    const row = mockJobRows.get(id);
    if (row) {
      row['status'] = 'active';
      row['attempts'] = (row['attempts'] as number) + 1;
    }
    return Promise.resolve();
  }),
  updateJobProgress: jest.fn((id: string, progress: number, stage: string): Promise<void> => {
    const row = mockJobRows.get(id);
    if (row) {
      row['progress'] = progress;
      row['stage'] = stage;
    }
    return Promise.resolve();
  }),
  markJobCompleted: jest.fn((id: string, result: unknown): Promise<void> => {
    const row = mockJobRows.get(id);
    if (row) {
      row['status'] = 'completed';
      row['progress'] = 100;
      row['result'] = result;
      row['completedAt'] = new Date().toISOString();
    }
    return Promise.resolve();
  }),
  markJobFailed: jest.fn((id: string, code: string, message: string): Promise<void> => {
    const row = mockJobRows.get(id);
    if (row) {
      row['status'] = 'failed';
      row['errorCode'] = code;
      row['errorMessage'] = message;
      row['completedAt'] = new Date().toISOString();
    }
    return Promise.resolve();
  }),
  markJobCancelled: jest.fn((id: string): Promise<boolean> => {
    const row = mockJobRows.get(id);
    if (row && ['queued', 'active', 'cancel_requested'].includes(row['status'] as string)) {
      row['status'] = 'cancelled';
      row['completedAt'] = new Date().toISOString();
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }),
  requestJobCancel: jest.fn((id: string): Promise<boolean> => {
    const row = mockJobRows.get(id);
    if (row && ['queued', 'active'].includes(row['status'] as string)) {
      row['status'] = 'cancel_requested';
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }),
  findOrphanedActive: jest.fn((): Promise<MockJobRow[]> => {
    return Promise.resolve(
      [...mockJobRows.values()]
        .filter((r) => r['status'] === 'active')
        .map((r) => cloneRow(r))
    );
  }),
  requeueJob: jest.fn((id: string): Promise<boolean> => {
    const row = mockJobRows.get(id);
    if (row && row['status'] === 'active') {
      row['status'] = 'queued';
      row['progress'] = 0;
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }),
  listOwnedJobs: jest.fn(),
}));

jest.mock('../repositories/projects', () => ({
  getPool: jest.fn(),
  getProject: jest.fn((userId: string, projectId: string): Promise<Record<string, unknown> | null> => {
    if (projectId === '223e4567-e89b-12d3-a456-426614174000') {
      return Promise.resolve({ id: projectId, user_id: userId, name: 'P' });
    }
    return Promise.resolve(null);
  }),
  listProjects: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
}));

const CSV = 'a,b\n1,2\n3,4\n5,6\n7,8\n';

jest.mock('../repositories/datasets', () => ({
  listDatasets: jest.fn(),
  getDataset: jest.fn((datasetId: string): Promise<Record<string, unknown> | null> => {
    if (datasetId === '323e4567-e89b-12d3-a456-426614174000') {
      return Promise.resolve({
        id: datasetId,
        projectId: '223e4567-e89b-12d3-a456-426614174000',
        storagePath: 'k',
        fileSizeBytes: CSV.length,
        status: 'ready',
      });
    }
    return Promise.resolve(null);
  }),
  createDataset: jest.fn(),
  markDatasetReady: jest.fn(),
  markDatasetFailed: jest.fn(),
  deleteDataset: jest.fn(),
  getDatasetStoragePath: jest.fn(),
}));

jest.mock('../storage', () => ({
  getStorage: jest.fn(() => ({
    download: (): Promise<Buffer> => Promise.resolve(Buffer.from(CSV)),
    upload: (): Promise<void> => Promise.resolve(),
    delete: (): Promise<void> => Promise.resolve(),
    getSignedUrl: (): Promise<string> => Promise.reject(new Error('disabled')),
  })),
  resetStorage: jest.fn(),
  setStorage: jest.fn(),
}));

jest.mock('../repositories/analyses', () => ({
  listAnalysesByProject: jest.fn(),
  getAnalysis: jest.fn(),
  createAnalysis: jest.fn((data: Record<string, unknown>): Promise<Record<string, unknown>> => {
    return Promise.resolve({ id: 'analysis-1', ...data, status: 'pending' });
  }),
  completeAnalysis: jest.fn((id: string, result: unknown): Promise<Record<string, unknown>> => {
    return Promise.resolve({ id, result });
  }),
  failAnalysis: jest.fn((): Promise<void> => Promise.resolve()),
  deleteAnalysis: jest.fn(),
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

const mockJuliaDescribe = jest.fn();

jest.mock('../services/juliaClient', () => ({
  juliaDescribe: (...args: unknown[]): Promise<unknown> => {
    const result: unknown = mockJuliaDescribe(...args);
    return Promise.resolve(result);
  },
  juliaCorrelation: jest.fn(),
  juliaCovariance: jest.fn(),
  juliaLinearAlgebra: jest.fn(),
  checkJuliaHealth: jest.fn(),
  JuliaServiceError: class JuliaServiceError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, message: string, statusCode = 502) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

jest.mock('../services/mlClient', () => ({
  trainModel: jest.fn(),
  checkMlHealth: jest.fn(),
  pythonDescribe: jest.fn(),
  pythonCorrelation: jest.fn(),
  pythonCovariance: jest.fn(),
  MlServiceError: class MlServiceError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, message: string, statusCode = 502) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

import { QueueEvents } from 'bullmq';
import {
  getAnalyticsQueue,
  enqueueAnalyticsJob,
  removeQueuedJob,
  bullmqJobIdFor,
  closeAnalyticsQueue,
} from '../queue/analyticsQueue';
import { startWorker, stopWorker, recoverOrphanedJobs } from '../queue/processor';
import { closeRedisConnection, getRedisConnection } from '../queue/connection';
import * as jobsRepo from '../repositories/jobs';

type MockCtor = new (code: string, message: string, status: number) => Error;

const RUN = process.env['RUN_QUEUE_INTEGRATION'] === '1';
const describeOrSkip = RUN ? describe : describe.skip;

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 20000,
  intervalMs = 200
): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (await predicate()) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function seedJob(params: Record<string, unknown> = {}): Promise<string> {
  const createMock = jobsRepo.createJob as unknown as (
    input: Record<string, unknown>
  ) => Promise<{ id: string }>;
  const created = await createMock({
    userId: '123e4567-e89b-12d3-a456-426614174000',
    projectId: '223e4567-e89b-12d3-a456-426614174000',
    datasetId: '323e4567-e89b-12d3-a456-426614174000',
    jobType: 'analysis.describe',
    params: {
      projectId: '223e4567-e89b-12d3-a456-426614174000',
      datasetId: '323e4567-e89b-12d3-a456-426614174000',
      analysisType: 'describe',
      ...params,
    },
    maxAttempts: 2,
    bullmqJobId: 'job:pending',
  });
  return created.id;
}

describeOrSkip('Queue integration (real Redis + real BullMQ)', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const projectId = '223e4567-e89b-12d3-a456-426614174000';
  const datasetId = '323e4567-e89b-12d3-a456-426614174000';

  beforeAll(async () => {
    // Fail fast with a clear message when Redis is down.
    await getRedisConnection().ping();
    await getAnalyticsQueue().obliterate({ force: true });
    startWorker();
  }, 60000);

  afterAll(async () => {
    await stopWorker();
    await closeAnalyticsQueue();
    await closeRedisConnection();
  });

  beforeEach(() => {
    mockJobRows.clear();
    jest.clearAllMocks();
    mockJuliaDescribe.mockResolvedValue({
      columns: [
        { name: 'a', count: 4, mean: 4, median: 4, std: 2, variance: 4, min: 1, max: 7, q1: 1, q3: 7, distinct: 4, warnings: [] },
      ],
      conventions: {},
    });
  });

  it('completes a describe job end-to-end with persisted result', async () => {
    const jobId = await seedJob();
    await enqueueAnalyticsJob(jobId, 'analysis.describe', {
      userId,
      projectId,
      datasetId,
      params: { projectId, datasetId, analysisType: 'describe' },
    });

    await waitFor(() => mockJobRows.get(jobId)?.['status'] === 'completed');

    const row = mockJobRows.get(jobId)!;
    expect(row['progress']).toBe(100);
    expect(row['result']).toBeDefined();
    expect((row['result'] as Record<string, unknown>)['kind']).toBe('describe');
  }, 60000);

  it('retries transient failures then succeeds', async () => {
    const { JuliaServiceError: MockedError }: { JuliaServiceError: MockCtor } =
      jest.requireMock('../services/juliaClient');
    mockJuliaDescribe
      .mockRejectedValueOnce(new MockedError('JULIA_UNAVAILABLE', 'down', 503))
      .mockResolvedValue({ columns: [], conventions: {} });

    const jobId = await seedJob();
    await enqueueAnalyticsJob(jobId, 'analysis.describe', {
      userId,
      projectId,
      datasetId,
      params: { projectId, datasetId, analysisType: 'describe' },
    });

    await waitFor(() => mockJobRows.get(jobId)?.['status'] === 'completed');
    expect(mockJuliaDescribe.mock.calls.length).toBeGreaterThanOrEqual(2);
  }, 60000);

  it('does not retry permanent failures', async () => {
    const { JuliaServiceError: MockedError }: { JuliaServiceError: MockCtor } =
      jest.requireMock('../services/juliaClient');
    mockJuliaDescribe.mockRejectedValue(new MockedError('JULIA_VALIDATION_ERROR', 'bad', 422));

    const jobId = await seedJob();
    await enqueueAnalyticsJob(jobId, 'analysis.describe', {
      userId,
      projectId,
      datasetId,
      params: { projectId, datasetId, analysisType: 'describe' },
    });

    await waitFor(() => mockJobRows.get(jobId)?.['status'] === 'failed');
    // UnrecoverableError → BullMQ never retries.
    expect(mockJuliaDescribe.mock.calls.length).toBe(1);
    expect(mockJobRows.get(jobId)?.['errorCode']).toBe('ANALYSIS_VALIDATION_ERROR');
  }, 60000);

  it('fails after exhausting attempts on persistent transient errors', async () => {
    const { JuliaServiceError: MockedError }: { JuliaServiceError: MockCtor } =
      jest.requireMock('../services/juliaClient');
    const rejecting = new MockedError('JULIA_TIMEOUT', 'slow', 504);
    mockJuliaDescribe.mockImplementation((): Promise<unknown> => Promise.reject(rejecting));

    const jobId = await seedJob();
    await enqueueAnalyticsJob(jobId, 'analysis.describe', {
      userId,
      projectId,
      datasetId,
      params: { projectId, datasetId, analysisType: 'describe' },
    });

    await waitFor(() => mockJobRows.get(jobId)?.['status'] === 'failed', 45000);
    // JOB_MAX_ATTEMPTS=4 absorbs up to 2 phantom first-delivery attempts seen
    // on Redis 5.0, so at least 2 real service calls precede the terminal state.
    expect(mockJuliaDescribe.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mockJobRows.get(jobId)?.['errorCode']).toBeDefined();
  }, 60000);

  it('removes a queued job from Redis on cancel', async () => {
    const queue = getAnalyticsQueue();
    await queue.pause();
    try {
      const jobId = await seedJob();
      const bullmqJobId = bullmqJobIdFor(jobId);
      await enqueueAnalyticsJob(jobId, 'analysis.describe', {
        userId,
        projectId,
        datasetId,
        params: { projectId, datasetId, analysisType: 'describe' },
      });
      expect(await queue.getJob(bullmqJobId)).toBeDefined();
      expect(await removeQueuedJob(bullmqJobId)).toBe(true);
      expect(await queue.getJob(bullmqJobId)).toBeFalsy();
    } finally {
      await queue.resume();
    }
  }, 60000);

  it('recovers orphaned active jobs without duplicating queue entries', async () => {
    const queue = getAnalyticsQueue();
    await queue.pause();
    try {
      const jobId = await seedJob();
      // Simulate a crashed worker: row stuck active, nothing in Redis.
      mockJobRows.get(jobId)!['status'] = 'active';

      const recovered = await recoverOrphanedJobs(0);
      expect(recovered).toBe(1);
      expect(mockJobRows.get(jobId)?.['status']).toBe('queued');
      // Deterministic jobId → re-adding is a dedupe, single entry.
      const data = {
        jobId,
        userId,
        jobType: 'analysis.describe' as const,
        projectId,
        datasetId,
        params: { projectId, datasetId, analysisType: 'describe' },
      };
      const again = await queue.add('analysis.describe', data, { jobId: 'job:pending' });
      expect(again.id).toBe('job:pending');
      const counts = await queue.getJobCounts('waiting', 'delayed', 'prioritized');
      const total =
        (counts['waiting'] ?? 0) + (counts['delayed'] ?? 0) + (counts['prioritized'] ?? 0);
      expect(total).toBe(1);
      // Cleanup so the worker does not pick it up after the test.
      await removeQueuedJob('job:pending');
    } finally {
      await queue.resume();
    }
  }, 60000);

  it('deduplicates re-enqueue by deterministic jobId', async () => {
    const queue = getAnalyticsQueue();
    const data = {
      jobId: 'dedupe-probe',
      userId,
      jobType: 'analysis.describe' as const,
      projectId,
      datasetId,
      params: { projectId, datasetId, analysisType: 'describe' },
    };
    const first = await queue.add('analysis.describe', data, { jobId: bullmqJobIdFor('dedupe-probe') });
    const second = await queue.add('analysis.describe', data, { jobId: bullmqJobIdFor('dedupe-probe') });
    expect(second.id).toBe(first.id);
    await removeQueuedJob(bullmqJobIdFor('dedupe-probe'));
  }, 60000);

  it('emits completion events with correlation ids', async () => {
    const events = new QueueEvents('nexusai-analytics', {
      connection: getRedisConnection().duplicate(),
    });
    try {
      const completed = new Promise<string>((resolve) => {
        events.on('completed', ({ jobId }) => resolve(jobId));
      });
      const jobId = await seedJob();
      await enqueueAnalyticsJob(jobId, 'analysis.describe', {
        userId,
        projectId,
        datasetId,
        params: { projectId, datasetId, analysisType: 'describe' },
      });
      const doneId = await Promise.race([
        completed,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('no event')), 20000)),
      ]);
      expect(doneId).toBe(bullmqJobIdFor(jobId));
    } finally {
      await events.close();
    }
  }, 60000);

  it('marks UnrecoverableError propagation (import sanity)', () => {
    expect(new UnrecoverableError('x').message).toBe('x');
  });
});
