import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { getProject } from '../repositories/projects';
import * as analysisRepo from '../repositories/analyses';
import { executeAnalysisJob } from '../services/analysisRunner';
import {
  runAnalysisSchema,
  analysisIdParamSchema,
} from '../schemas/analyses';
import type { AnalysisRun } from '@nexusai/shared';

function respond(res: Response, data: unknown, status = 200): void {
  res.status(status).json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), version: 'v1' },
  });
}

async function requireOwnedAnalysis(userId: string, analysisId: string): Promise<AnalysisRun> {
  const analysis = await analysisRepo.getAnalysis(analysisId);
  if (!analysis) {
    throw AppError.notFound('ANALYSIS_NOT_FOUND', 'Analysis not found');
  }
  const project = await getProject(userId, analysis.projectId);
  if (!project) {
    throw AppError.notFound('ANALYSIS_NOT_FOUND', 'Analysis not found');
  }
  return analysis;
}

export async function runAnalysis(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');

  let input;
  try {
    input = runAnalysisSchema.parse(req.body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Invalid analysis request', {
        details: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }
    throw error;
  }

  const projectId = req.params['projectId']!;
  const project = await getProject(req.user.id, projectId);
  if (!project) throw AppError.notFound('PROJECT_NOT_FOUND', 'Project not found');

  const engine = input.analysisType === 'compare' ? 'comparison' : ('julia' as const);
  const record = await analysisRepo.createAnalysis({
    projectId,
    datasetId: input.datasetId,
    userId: req.user.id,
    analysisType: input.analysisType,
    engine,
    config: {
      columns: input.columns,
      missingPolicy: input.missingPolicy,
      maxRows: input.maxRows,
    },
  });

  // Synchronous execution shares the exact code path with the async worker
  // (services/analysisRunner). Small workloads complete within the request.
  try {
    const { result } = await executeAnalysisJob(req.user.id, {
      analysisType: input.analysisType,
      projectId,
      datasetId: input.datasetId,
      columns: input.columns,
      missingPolicy: input.missingPolicy,
      maxRows: input.maxRows,
    });
    await analysisRepo.completeAnalysis(record.id, result);
    const completed = await analysisRepo.getAnalysis(record.id);
    respond(res, completed, 201);
  } catch (error) {
    if (error instanceof AppError && error.statusCode < 500) {
      await analysisRepo.failAnalysis(record.id, error.message);
      throw error;
    }
    if (error instanceof AppError) {
      await analysisRepo.failAnalysis(record.id, error.message);
      throw error;
    }
    logger.error('Unexpected analysis failure', { analysisId: record.id });
    await analysisRepo.failAnalysis(record.id, 'Analysis failed');
    throw AppError.internal('ANALYSIS_FAILED', 'Analysis failed');
  }
}

export async function listProjectAnalyses(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  const projectId = req.params['projectId']!;
  const project = await getProject(req.user.id, projectId);
  if (!project) throw AppError.notFound('PROJECT_NOT_FOUND', 'Project not found');
  respond(res, await analysisRepo.listAnalysesByProject(projectId));
}

export async function getAnalysisById(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  const { analysisId } = analysisIdParamSchema.parse(req.params);
  const analysis = await requireOwnedAnalysis(req.user.id, analysisId);
  respond(res, analysis);
}

export async function deleteAnalysisById(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  const { analysisId } = analysisIdParamSchema.parse(req.params);
  await requireOwnedAnalysis(req.user.id, analysisId);
  const deleted = await analysisRepo.deleteAnalysis(analysisId);
  if (!deleted) throw AppError.notFound('ANALYSIS_NOT_FOUND', 'Analysis not found');
  res.status(204).send();
}
