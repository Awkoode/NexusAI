import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { getProject } from '../repositories/projects';
import * as experimentRepo from '../repositories/experiments';
import { executeTraining } from '../services/trainingRunner';
import { requireReadyDataset } from '../services/datasetLoader';
import {
  createExperimentSchema,
  experimentIdParamSchema,
} from '../schemas/experiments';
import type { Experiment } from '@nexusai/shared';

function respond(res: Response, data: unknown, status = 200): void {
  res.status(status).json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), version: 'v1' },
  });
}

async function requireOwnedExperiment(userId: string, experimentId: string): Promise<Experiment> {
  const experiment = await experimentRepo.getExperiment(experimentId);
  if (!experiment) {
    throw AppError.notFound('EXPERIMENT_NOT_FOUND', 'Experiment not found');
  }
  const project = await getProject(userId, experiment.projectId);
  if (!project) {
    // Hide existence of other users' experiments.
    throw AppError.notFound('EXPERIMENT_NOT_FOUND', 'Experiment not found');
  }
  return experiment;
}

export async function createExperiment(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');

  let input;
  try {
    input = createExperimentSchema.parse(req.body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Invalid experiment data', {
        details: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }
    throw error;
  }

  await requireReadyDataset(req.user.id, input.projectId, input.datasetId);

  const defaultName = `${input.taskType === 'regression' ? 'Regression' : 'Classification'} — ${input.modelType} — ${input.targetColumn}`;
  const experiment = await experimentRepo.createExperiment({
    projectId: input.projectId,
    datasetId: input.datasetId,
    userId: req.user.id,
    name: input.name?.trim() ? input.name.trim() : defaultName,
    taskType: input.taskType,
    modelType: input.modelType,
    targetColumn: input.targetColumn,
    featureColumns: input.featureColumns,
    config: { testSize: input.testSize, randomState: input.randomState },
  });

  // Synchronous execution (documented): training small tabular datasets
  // completes within the request timeout. Returns 201 with results inline.
  const completed = await executeTraining(experiment);
  const latestRun = await experimentRepo.getLatestRun(completed.id);
  respond(res, { ...completed, latestRun }, 201);
}

export async function listProjectExperiments(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  const projectId = req.params['projectId']!;
  const project = await getProject(req.user.id, projectId);
  if (!project) throw AppError.notFound('PROJECT_NOT_FOUND', 'Project not found');
  const experiments = await experimentRepo.listExperimentsByProject(projectId);
  const withRuns = await Promise.all(
    experiments.map(async (e) => ({ ...e, latestRun: await experimentRepo.getLatestRun(e.id) }))
  );
  respond(res, withRuns);
}

export async function getExperimentById(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  const { id } = experimentIdParamSchema.parse(req.params);
  const experiment = await requireOwnedExperiment(req.user.id, id);
  const latestRun = await experimentRepo.getLatestRun(id);
  respond(res, { ...experiment, latestRun });
}

export async function listExperimentRuns(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  const { id } = experimentIdParamSchema.parse(req.params);
  await requireOwnedExperiment(req.user.id, id);
  respond(res, await experimentRepo.listRuns(id));
}

export async function runExperiment(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  const { id } = experimentIdParamSchema.parse(req.params);
  const experiment = await requireOwnedExperiment(req.user.id, id);
  if (experiment.status === 'running' || experiment.status === 'pending') {
    throw AppError.badRequest('EXPERIMENT_BUSY', 'Experiment is already running');
  }
  const completed = await executeTraining(experiment);
  const latestRun = await experimentRepo.getLatestRun(completed.id);
  respond(res, { ...completed, latestRun });
}

export async function deleteExperimentById(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  const { id } = experimentIdParamSchema.parse(req.params);
  await requireOwnedExperiment(req.user.id, id);
  const deleted = await experimentRepo.deleteExperiment(id);
  if (!deleted) throw AppError.notFound('EXPERIMENT_NOT_FOUND', 'Experiment not found');
  res.status(204).send();
}
