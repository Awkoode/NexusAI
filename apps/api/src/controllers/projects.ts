import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { createProjectSchema, updateProjectSchema } from '../schemas/projects';
import * as projectRepo from '../repositories/projects';
import { AppError } from '../middleware/errorHandler';

export async function listProjects(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  }

  const projects = await projectRepo.listProjects(req.user.id);

  res.json({
    success: true,
    data: projects,
    meta: {
      timestamp: new Date().toISOString(),
      version: 'v1',
    },
  });
}

export async function getProject(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  }

  const { id } = req.params as { id: string };
  const project = await projectRepo.getProject(req.user.id, id);

  if (!project) {
    throw AppError.notFound('PROJECT_NOT_FOUND', 'Project not found');
  }

  res.json({
    success: true,
    data: project,
    meta: {
      timestamp: new Date().toISOString(),
      version: 'v1',
    },
  });
}

export async function createProject(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  }

  try {
    const input = createProjectSchema.parse(req.body);
    const project = await projectRepo.createProject(req.user.id, input.name, input.description);

    res.status(201).json({
      success: true,
      data: project,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw AppError.badRequest('VALIDATION_ERROR', 'Invalid project data', { details });
    }
    throw error;
  }
}

export async function updateProject(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  }

  const { id } = req.params as { id: string };

  try {
    const input = updateProjectSchema.parse(req.body);
    const project = await projectRepo.updateProject(
      req.user.id,
      id,
      input.name,
      input.description
    );

    if (!project) {
      throw AppError.notFound('PROJECT_NOT_FOUND', 'Project not found');
    }

    res.json({
      success: true,
      data: project,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw AppError.badRequest('VALIDATION_ERROR', 'Invalid project data', { details });
    }
    throw error;
  }
}

export async function deleteProject(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  }

  const { id } = req.params as { id: string };
  const deleted = await projectRepo.deleteProject(req.user.id, id);

  if (!deleted) {
    throw AppError.notFound('PROJECT_NOT_FOUND', 'Project not found');
  }

  res.status(204).send();
}