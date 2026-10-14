// Set required env vars BEFORE importing anything
process.env['NODE_ENV'] = 'test';
process.env['API_VERSION'] = 'v1';
process.env['PORT'] = '3001';
process.env['CORS_ORIGIN'] = 'http://localhost:3000';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
process.env['MAX_UPLOAD_MB'] = '10';

import { createApp } from '../index';
import request from 'supertest';

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

jest.mock('../services/mlClient', () => ({
  trainModel: jest.fn(),
  checkMlHealth: jest.fn(),
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

jest.mock('../storage', () => ({
  getStorage: jest.fn(),
  resetStorage: jest.fn(),
  setStorage: jest.fn(),
}));

import * as projectRepo from '../repositories/projects';
import * as datasetRepo from '../repositories/datasets';
import * as experimentRepo from '../repositories/experiments';
import { trainModel } from '../services/mlClient';
import { getStorage } from '../storage';

function getBody(response: request.Response): Record<string, unknown> {
  return response.body as Record<string, unknown>;
}

describe('Experiments Endpoints', () => {
  let app: ReturnType<typeof createApp>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    user_metadata: {},
  };
  const projectId = '223e4567-e89b-12d3-a456-426614174000';
  const datasetId = '323e4567-e89b-12d3-a456-426614174000';
  const experimentId = '423e4567-e89b-12d3-a456-426614174000';

  const baseBody = {
    projectId,
    datasetId,
    taskType: 'regression',
    modelType: 'linear_regression',
    targetColumn: 'price',
    featureColumns: ['size', 'bedrooms'],
    testSize: 0.2,
    randomState: 42,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    (projectRepo.getProject as jest.Mock).mockResolvedValue({ id: projectId, name: 'P' });
    (datasetRepo.getDataset as jest.Mock).mockResolvedValue({
      id: datasetId,
      projectId,
      storagePath: 'k',
      fileSizeBytes: 100,
      status: 'ready',
    });
    (getStorage as jest.Mock).mockReturnValue({
      download: () => Promise.resolve(Buffer.from('size,bedrooms,price\n1,2,3\n4,5,6\n7,8,9\n10,11,12\n')),
    });
  });

  it('rejects unauthenticated creation with 401', async () => {
    const response = await request(app).post('/api/v1/experiments').send(baseBody);
    expect(response.status).toBe(401);
  });

  it('rejects disallowed model names with 400', async () => {
    const response = await request(app)
      .post('/api/v1/experiments')
      .set('Authorization', 'Bearer valid-token')
      .send({ ...baseBody, modelType: 'os.system' });
    expect(response.status).toBe(400);
  });

  it('rejects target inside features with 400', async () => {
    const response = await request(app)
      .post('/api/v1/experiments')
      .set('Authorization', 'Bearer valid-token')
      .send({ ...baseBody, featureColumns: ['size', 'price'] });
    expect(response.status).toBe(400);
  });

  it('creates, runs, and persists a regression experiment (201)', async () => {
    (experimentRepo.createExperiment as jest.Mock).mockResolvedValue({
      id: experimentId,
      projectId,
      datasetId,
      taskType: 'regression',
      modelType: 'linear_regression',
      targetColumn: 'price',
      featureColumns: ['size', 'bedrooms'],
      config: { testSize: 0.2, randomState: 42 },
      status: 'pending',
    });
    (trainModel as jest.Mock).mockResolvedValue({
      task_type: 'regression',
      model_type: 'linear_regression',
      target_column: 'price',
      feature_columns: ['size', 'bedrooms'],
      test_size: 0.2,
      random_state: 42,
      metrics: { mae: 1.5, rmse: 2.0, r2: 0.9, train_samples: 3, test_samples: 1 },
      predictions_summary: { count: 1 },
      train_seconds: 0.1,
      library_versions: { 'scikit-learn': '1.9.1' },
    });
    (experimentRepo.createRun as jest.Mock).mockResolvedValue({ id: 'run-1', status: 'running' });
    (experimentRepo.getExperiment as jest.Mock).mockResolvedValue({
      id: experimentId,
      status: 'completed',
    });
    (experimentRepo.getLatestRun as jest.Mock).mockResolvedValue({
      id: 'run-1',
      status: 'completed',
      metrics: { mae: 1.5 },
    });

    const response = await request(app)
      .post('/api/v1/experiments')
      .set('Authorization', 'Bearer valid-token')
      .send(baseBody);

    expect(response.status).toBe(201);
    expect(getBody(response)['success']).toBe(true);
    expect(experimentRepo.markExperimentCompleted).toHaveBeenCalledWith(experimentId);
    expect(experimentRepo.completeRun).toHaveBeenCalled();
    // Python received real parsed columns, never a user path
    const calls = (trainModel as jest.Mock).mock.calls as unknown[][];
    const payload = calls[0]?.[0] as Record<string, unknown>;
    expect(payload['target_column']).toBe('price');
    expect(payload['columns']).toContain('price');
  });

  it('persists failed state when Python rejects the config (400)', async () => {
    const { MlServiceError: MockedMlError }: { MlServiceError: new (code: string, message: string, status: number) => Error } =
      jest.requireMock('../services/mlClient');
    (experimentRepo.createExperiment as jest.Mock).mockResolvedValue({
      id: experimentId,
      status: 'pending',
      projectId,
      datasetId,
      taskType: 'regression',
      modelType: 'linear_regression',
      targetColumn: 'price',
      featureColumns: ['size'],
      config: { testSize: 0.2, randomState: 42 },
    });
    (experimentRepo.createRun as jest.Mock).mockResolvedValue({ id: 'run-1' });
    (trainModel as jest.Mock).mockRejectedValue(
      new MockedMlError('ML_VALIDATION_ERROR', 'target has no variation', 422)
    );

    const response = await request(app)
      .post('/api/v1/experiments')
      .set('Authorization', 'Bearer valid-token')
      .send({ ...baseBody, featureColumns: ['size'] });

    expect(response.status).toBe(400);
    expect(getBody(response)['error']).toBeDefined();
    expect(experimentRepo.markExperimentFailed).toHaveBeenCalledWith(
      experimentId,
      'target has no variation'
    );
  });

  it('returns 503 when the ML service is down', async () => {
    const { MlServiceError: MockedMlError }: { MlServiceError: new (code: string, message: string, status: number) => Error } =
      jest.requireMock('../services/mlClient');
    (experimentRepo.createExperiment as jest.Mock).mockResolvedValue({
      id: experimentId,
      status: 'pending',
      projectId,
      datasetId,
      taskType: 'regression',
      modelType: 'linear_regression',
      targetColumn: 'price',
      featureColumns: ['size'],
      config: { testSize: 0.2, randomState: 42 },
    });
    (experimentRepo.createRun as jest.Mock).mockResolvedValue({ id: 'run-1' });
    (trainModel as jest.Mock).mockRejectedValue(
      new MockedMlError('ML_UNAVAILABLE', 'ML service is unavailable', 503)
    );

    const response = await request(app)
      .post('/api/v1/experiments')
      .set('Authorization', 'Bearer valid-token')
      .send({ ...baseBody, featureColumns: ['size'] });

    expect(response.status).toBe(503);
    expect(experimentRepo.markExperimentFailed).toHaveBeenCalled();
  });

  it('hides other users experiments with 404', async () => {
    (experimentRepo.getExperiment as jest.Mock).mockResolvedValue({
      id: experimentId,
      projectId: 'other-project',
    });
    (projectRepo.getProject as jest.Mock).mockResolvedValue(null);

    const response = await request(app)
      .get(`/api/v1/experiments/${experimentId}`)
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(404);
  });

  it('lists run history for owned experiments', async () => {
    (experimentRepo.getExperiment as jest.Mock).mockResolvedValue({
      id: experimentId,
      projectId,
    });
    (experimentRepo.listRuns as jest.Mock).mockResolvedValue([{ id: 'run-1' }]);

    const response = await request(app)
      .get(`/api/v1/experiments/${experimentId}/runs`)
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
  });

  it('refuses to re-run a running experiment', async () => {
    (experimentRepo.getExperiment as jest.Mock).mockResolvedValue({
      id: experimentId,
      projectId,
      status: 'running',
    });

    const response = await request(app)
      .post(`/api/v1/experiments/${experimentId}/run`)
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(400);
  });
});
