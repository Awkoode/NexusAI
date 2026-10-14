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

import * as projectRepo from '../repositories/projects';
import * as datasetRepo from '../repositories/datasets';
import { setStorage, resetStorage, type StorageProvider } from '../storage';

const CSV = 'name,age,city\nAlice,30,Lisbon\nBob,,Porto\nCarol,25,Lisbon\n';

function memoryStorage(files: Map<string, Buffer>): StorageProvider {
  return {
    upload: (key: string, buffer: Buffer) => {
      files.set(key, buffer);
      return Promise.resolve();
    },
    download: (key: string) => {
      const buf = files.get(key);
      if (!buf) return Promise.reject(new Error('not found'));
      return Promise.resolve(buf);
    },
    delete: (key: string) => {
      files.delete(key);
      return Promise.resolve();
    },
    getSignedUrl: () => Promise.reject(new Error('disabled')),
  } as unknown as StorageProvider;
}

function getBody(response: request.Response): Record<string, unknown> {
  return response.body as Record<string, unknown>;
}

describe('Datasets Endpoints', () => {
  let app: ReturnType<typeof createApp>;
  const files = new Map<string, Buffer>();

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    user_metadata: {},
  };
  const projectId = '223e4567-e89b-12d3-a456-426614174000';
  const datasetId = '323e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
    files.clear();
    resetStorage();
    setStorage(memoryStorage(files));
    app = createApp();
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    (projectRepo.getProject as jest.Mock).mockResolvedValue({
      id: projectId,
      name: 'P',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it('rejects unauthenticated upload with 401', async () => {
    const response = await request(app).post(`/api/v1/projects/${projectId}/datasets`);
    expect(response.status).toBe(401);
  });

  it('rejects access to another user project with 404', async () => {
    (projectRepo.getProject as jest.Mock).mockResolvedValue(null);
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/datasets`)
      .set('Authorization', 'Bearer valid-token')
      .attach('file', Buffer.from(CSV), 'data.csv');
    expect(response.status).toBe(404);
  });

  it('uploads a valid CSV and marks it ready with real counts', async () => {
    (datasetRepo.createDataset as jest.Mock).mockImplementation((data: unknown) =>
      Promise.resolve({
        ...(data as object),
        id: datasetId,
        status: 'uploaded',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
    (datasetRepo.markDatasetReady as jest.Mock).mockImplementation(
      (id: string, rowCount: number, columnCount: number) =>
        Promise.resolve({
          id,
          status: 'ready',
          rowCount,
          columnCount,
        })
    );
    (datasetRepo.getDataset as jest.Mock).mockResolvedValue({
      id: datasetId,
      projectId,
      userId: mockUser.id,
      name: 'data',
      originalFilename: 'data.csv',
      storagePath: 'k',
      mimeType: 'text/csv',
      fileSizeBytes: 10,
      rowCount: 3,
      columnCount: 3,
      status: 'ready',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/datasets`)
      .set('Authorization', 'Bearer valid-token')
      .attach('file', Buffer.from(CSV), 'data.csv');

    expect(response.status).toBe(201);
    expect(getBody(response)['success']).toBe(true);
    const data = getBody(response)['data'] as Record<string, unknown>;
    expect(data['status']).toBe('ready');
    // File persisted to storage
    expect(files.size).toBe(1);
    // Ready marker called with real dimensions (3 rows, 3 cols)
    const markCall = (datasetRepo.markDatasetReady as jest.Mock).mock.calls[0] as unknown[];
    expect(markCall[1]).toBe(3);
    expect(markCall[2]).toBe(3);
  });

  it('rejects missing file with 400', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/datasets`)
      .set('Authorization', 'Bearer valid-token');
    expect(response.status).toBe(400);
  });

  it('rejects empty file with 400', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/datasets`)
      .set('Authorization', 'Bearer valid-token')
      .attach('file', Buffer.from(''), 'empty.csv');
    expect(response.status).toBe(400);
  });

  it('rejects malformed CSV with 400 and failed state', async () => {
    (datasetRepo.createDataset as jest.Mock).mockResolvedValue({ id: datasetId, status: 'uploaded' });
    (datasetRepo.markDatasetFailed as jest.Mock).mockResolvedValue({ id: datasetId, status: 'failed' });
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/datasets`)
      .set('Authorization', 'Bearer valid-token')
      .attach('file', Buffer.from('a,b\n1,2,3\n'), 'bad.csv');
    expect(response.status).toBe(400);
    expect(datasetRepo.markDatasetFailed).toHaveBeenCalled();
  });

  it('rejects files over the limit with 413', async () => {
    const big = Buffer.alloc(11 * 1024 * 1024, 'a');
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/datasets`)
      .set('Authorization', 'Bearer valid-token')
      .attach('file', big, 'big.csv');
    expect(response.status).toBe(413);
  }, 30000);

  it('returns preview with real rows and column types', async () => {
    const storageKey = 'k';
    files.set(storageKey, Buffer.from(CSV));
    (datasetRepo.getDataset as jest.Mock).mockResolvedValue({
      id: datasetId,
      projectId,
      userId: mockUser.id,
      name: 'data',
      originalFilename: 'data.csv',
      storagePath: storageKey,
      mimeType: 'text/csv',
      fileSizeBytes: CSV.length,
      rowCount: 3,
      columnCount: 3,
      status: 'ready',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await request(app)
      .get(`/api/v1/datasets/${datasetId}/preview?limit=2`)
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    const data = getBody(response)['data'] as Record<string, unknown>;
    expect(data['headers']).toEqual(['name', 'age', 'city']);
    expect(data['totalRows']).toBe(3);
    expect((data['rows'] as string[][]).length).toBe(2);
  });

  it('returns a profile computed from real data without NaN', async () => {
    const storageKey = 'k';
    files.set(storageKey, Buffer.from(CSV));
    (datasetRepo.getDataset as jest.Mock).mockResolvedValue({
      id: datasetId,
      projectId,
      userId: mockUser.id,
      name: 'data',
      originalFilename: 'data.csv',
      storagePath: storageKey,
      mimeType: 'text/csv',
      fileSizeBytes: CSV.length,
      rowCount: 3,
      columnCount: 3,
      status: 'ready',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await request(app)
      .get(`/api/v1/datasets/${datasetId}/profile`)
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    const data = getBody(response)['data'] as Record<string, unknown>;
    expect(data['rowCount']).toBe(3);
    expect(data['columnCount']).toBe(3);
    expect(JSON.stringify(data)).not.toMatch(/NaN/);
  });

  it('prevents access to another user dataset', async () => {
    (datasetRepo.getDataset as jest.Mock).mockResolvedValue({
      id: datasetId,
      projectId: 'other-project',
      userId: 'other-user',
    });
    (projectRepo.getProject as jest.Mock).mockResolvedValue(null);
    const response = await request(app)
      .get(`/api/v1/datasets/${datasetId}`)
      .set('Authorization', 'Bearer valid-token');
    expect(response.status).toBe(404);
  });

  it('deletes dataset metadata and stored object consistently', async () => {
    const storageKey = 'k';
    files.set(storageKey, Buffer.from(CSV));
    (datasetRepo.getDataset as jest.Mock).mockResolvedValue({
      id: datasetId,
      projectId,
      userId: mockUser.id,
      storagePath: storageKey,
      status: 'ready',
    });
    (datasetRepo.deleteDataset as jest.Mock).mockResolvedValue(true);

    const response = await request(app)
      .delete(`/api/v1/datasets/${datasetId}`)
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(204);
    expect(files.has(storageKey)).toBe(false);
    expect(datasetRepo.deleteDataset).toHaveBeenCalledWith(datasetId);
  });
});
