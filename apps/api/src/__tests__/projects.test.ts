// Set required env vars BEFORE importing anything
process.env['NODE_ENV'] = 'test';
process.env['API_VERSION'] = 'v1';
process.env['PORT'] = '3001';
process.env['CORS_ORIGIN'] = 'http://localhost:3000';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';

import { createApp } from '../index';
import request from 'supertest';
import type { Project } from '@nexusai/shared';

// Mock the logger to avoid noise in tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Supabase auth
const mockGetUser = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

// Mock the projects repository
jest.mock('../repositories/projects', () => ({
  listProjects: jest.fn(),
  getProject: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  getPool: jest.fn(),
}));

import * as projectRepo from '../repositories/projects';

function getBody(response: request.Response): Record<string, unknown> {
  return response.body as Record<string, unknown>;
}

describe('Projects Endpoints', () => {
  let app: ReturnType<typeof createApp>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    user_metadata: { display_name: 'Test User' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();

    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  describe('Authentication', () => {
    it('should reject requests without token', async () => {
      const response = await request(app).get('/api/v1/projects');

      expect(response.status).toBe(401);
      expect(getBody(response)['error']).toBeDefined();
    });

    it('should reject requests with invalid token', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const response = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(getBody(response)['error']).toBeDefined();
    });
  });

  describe('GET /api/v1/projects', () => {
    it('should list projects for authenticated user', async () => {
      const mockProjects: Project[] = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Project 1',
          description: 'Description 1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      (projectRepo.listProjects as jest.Mock).mockResolvedValue(mockProjects);

      const response = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(getBody(response)['success']).toBe(true);
      expect(getBody(response)['data']).toEqual(mockProjects);
    });
  });

  describe('POST /api/v1/projects', () => {
    it('should create a project with valid data', async () => {
      const newProject: Project = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'New Project',
        description: 'New Description',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (projectRepo.createProject as jest.Mock).mockResolvedValue(newProject);

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'New Project', description: 'New Description' });

      expect(response.status).toBe(201);
      expect(getBody(response)['success']).toBe(true);
      expect(getBody(response)['data']).toEqual(newProject);
    });

    it('should reject project creation without name', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', 'Bearer valid-token')
        .send({ description: 'No name' });

      expect(response.status).toBe(400);
      expect(getBody(response)['error']).toBeDefined();
    });

    it('should reject project creation with empty name', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: '' });

      expect(response.status).toBe(400);
      expect(getBody(response)['error']).toBeDefined();
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    it('should get a project by ID', async () => {
      const mockProject: Project = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Project 1',
        description: 'Description 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (projectRepo.getProject as jest.Mock).mockResolvedValue(mockProject);

      const response = await request(app)
        .get('/api/v1/projects/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(getBody(response)['success']).toBe(true);
      expect(getBody(response)['data']).toEqual(mockProject);
    });

    it('should return 404 for non-existent project', async () => {
      (projectRepo.getProject as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/projects/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(getBody(response)['error']).toBeDefined();
    });
  });

  describe('PATCH /api/v1/projects/:id', () => {
    it('should update a project', async () => {
      const updatedProject: Project = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Updated Project',
        description: 'Updated Description',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (projectRepo.updateProject as jest.Mock).mockResolvedValue(updatedProject);

      const response = await request(app)
        .patch('/api/v1/projects/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated Project' });

      expect(response.status).toBe(200);
      expect(getBody(response)['success']).toBe(true);
      expect(getBody(response)['data']).toEqual(updatedProject);
    });

    it('should reject empty update', async () => {
      const response = await request(app)
        .patch('/api/v1/projects/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(getBody(response)['error']).toBeDefined();
    });
  });

  describe('DELETE /api/v1/projects/:id', () => {
    it('should delete a project', async () => {
      (projectRepo.deleteProject as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/v1/projects/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
    });

    it('should return 404 when deleting non-existent project', async () => {
      (projectRepo.deleteProject as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/v1/projects/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(getBody(response)['error']).toBeDefined();
    });
  });
});