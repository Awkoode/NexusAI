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

jest.mock('../repositories/analyses', () => ({
  listAnalysesByProject: jest.fn(),
  getAnalysis: jest.fn(),
  createAnalysis: jest.fn(),
  completeAnalysis: jest.fn(),
  failAnalysis: jest.fn(),
  deleteAnalysis: jest.fn(),
}));

jest.mock('../storage', () => ({
  getStorage: jest.fn(),
  resetStorage: jest.fn(),
  setStorage: jest.fn(),
}));

jest.mock('../services/juliaClient', () => ({
  juliaDescribe: jest.fn(),
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

import * as projectRepo from '../repositories/projects';
import * as datasetRepo from '../repositories/datasets';
import * as analysisRepo from '../repositories/analyses';
import { getStorage } from '../storage';
import { juliaDescribe, juliaCorrelation, juliaCovariance } from '../services/juliaClient';
import { pythonDescribe, pythonCorrelation, pythonCovariance } from '../services/mlClient';

function getBody(response: request.Response): Record<string, unknown> {
  return response.body as Record<string, unknown>;
}

const CSV = 'a,b,c\n1,2,3\n4,5,6\n7,8,9\n10,11,12\n';

describe('Analyses Endpoints', () => {
  let app: ReturnType<typeof createApp>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    user_metadata: {},
  };
  const projectId = '223e4567-e89b-12d3-a456-426614174000';
  const datasetId = '323e4567-e89b-12d3-a456-426614174000';
  const analysisId = '523e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    (projectRepo.getProject as jest.Mock).mockResolvedValue({ id: projectId, name: 'P' });
    (datasetRepo.getDataset as jest.Mock).mockResolvedValue({
      id: datasetId,
      projectId,
      storagePath: 'k',
      fileSizeBytes: CSV.length,
      status: 'ready',
    });
    (getStorage as jest.Mock).mockReturnValue({
      download: () => Promise.resolve(Buffer.from(CSV)),
    });
    (analysisRepo.createAnalysis as jest.Mock).mockImplementation((data: unknown) =>
      Promise.resolve({
        ...(data as object),
        id: analysisId,
        status: 'running',
        createdAt: new Date().toISOString(),
      })
    );
    (analysisRepo.getAnalysis as jest.Mock).mockResolvedValue({
      id: analysisId,
      projectId,
      datasetId,
      status: 'completed',
      result: { kind: 'describe', columns: [] },
    });
  });

  it('rejects unauthenticated analysis with 401', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/analyses`)
      .send({ datasetId, analysisType: 'describe' });
    expect(response.status).toBe(401);
  });

  it('rejects unknown analysis types with 400', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/analyses`)
      .set('Authorization', 'Bearer valid-token')
      .send({ datasetId, analysisType: 'forecast' });
    expect(response.status).toBe(400);
  });

  it('runs describe via Julia and persists the result (201)', async () => {
    (juliaDescribe as jest.Mock).mockResolvedValue({
      columns: [{ name: 'a', count: 4, mean: 5.5 }],
      conventions: {},
    });
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/analyses`)
      .set('Authorization', 'Bearer valid-token')
      .send({ datasetId, analysisType: 'describe' });
    expect(response.status).toBe(201);
    expect(getBody(response)['success']).toBe(true);
    expect(analysisRepo.completeAnalysis).toHaveBeenCalled();
    const calls = (juliaDescribe as jest.Mock).mock.calls as unknown[][];
    const payload = calls[0]?.[0] as Record<string, unknown>;
    expect(payload['columns']).toBeDefined();
  });

  it('persists failed state when Julia is down (503)', async () => {
    const { JuliaServiceError: MockedError }: { JuliaServiceError: new (c: string, m: string, s: number) => Error } =
      jest.requireMock('../services/juliaClient');
    (juliaDescribe as jest.Mock).mockRejectedValue(new MockedError('JULIA_UNAVAILABLE', 'down', 503));
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/analyses`)
      .set('Authorization', 'Bearer valid-token')
      .send({ datasetId, analysisType: 'describe' });
    expect(response.status).toBe(503);
    expect(analysisRepo.failAnalysis).toHaveBeenCalled();
  });

  it('hides other users analyses with 404', async () => {
    (analysisRepo.getAnalysis as jest.Mock).mockResolvedValue({
      id: analysisId,
      projectId: 'other-project',
    });
    (projectRepo.getProject as jest.Mock).mockResolvedValue(null);
    const response = await request(app)
      .get(`/api/v1/analyses/${analysisId}`)
      .set('Authorization', 'Bearer valid-token');
    expect(response.status).toBe(404);
  });

  it('compares Python and Julia independently with agreement flags', async () => {
    const cols = [
      { name: 'a', count: 4, mean: 5.5, median: 5.5, std: 3.0, variance: 9.0, q1: 1, q3: 10, min: 1, max: 10 },
      { name: 'b', count: 4, mean: 6.5, median: 6.5, std: 3.0, variance: 9.0, q1: 1, q3: 10, min: 2, max: 11 },
    ];
    (pythonDescribe as jest.Mock).mockResolvedValue({ columns: cols, conventions: {} });
    (juliaDescribe as jest.Mock).mockResolvedValue({
      columns: cols.map((c) => ({ ...c, mean: c.mean + 1e-12 })),
      conventions: {},
    });
    (pythonCorrelation as jest.Mock).mockResolvedValue({
      columns: ['a', 'b'],
      matrix: [[1, 0.5], [0.5, 1]],
      pair_n: [[4, 4], [4, 4]],
    });
    (juliaCorrelation as jest.Mock).mockResolvedValue({
      columns: ['a', 'b'],
      matrix: [[1, 0.5], [0.5, 1]],
      pair_n: [[4, 4], [4, 4]],
    });
    (pythonCovariance as jest.Mock).mockResolvedValue({
      columns: ['a', 'b'],
      matrix: [[9, 4.5], [4.5, 9]],
      pair_n: [[4, 4], [4, 4]],
    });
    (juliaCovariance as jest.Mock).mockResolvedValue({
      columns: ['a', 'b'],
      matrix: [[9, 4.5], [4.5, 9]],
      pair_n: [[4, 4], [4, 4]],
    });

    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/analyses`)
      .set('Authorization', 'Bearer valid-token')
      .send({ datasetId, analysisType: 'compare', columns: ['a', 'b'] });

    expect(response.status).toBe(201);
    const data = getBody(response)['data'] as Record<string, unknown>;
    // createAnalysis returns the analysis row; completed row comes from getAnalysis mock
    expect(data['status']).toBe('completed');
    expect(analysisRepo.completeAnalysis).toHaveBeenCalled();
    const completeCalls = (analysisRepo.completeAnalysis as jest.Mock).mock.calls as unknown[][];
    const persisted = completeCalls[0]?.[1] as Record<string, unknown>;
    expect(persisted['kind']).toBe('compare');
    const entries = persisted['entries'] as Record<string, unknown>[];
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e['agrees'] === true)).toBe(true);
  });

  it('rejects compare with too many columns', async () => {
    const many = Array.from({ length: 11 }, (_, i) => `c${i}`);
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/analyses`)
      .set('Authorization', 'Bearer valid-token')
      .send({ datasetId, analysisType: 'compare', columns: many });
    expect(response.status).toBe(400);
  });

  it('lists analysis history for owned projects', async () => {
    (analysisRepo.listAnalysesByProject as jest.Mock).mockResolvedValue([{ id: analysisId }]);
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/analyses`)
      .set('Authorization', 'Bearer valid-token');
    expect(response.status).toBe(200);
  });
});
