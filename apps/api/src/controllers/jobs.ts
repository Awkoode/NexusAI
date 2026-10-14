import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { getEnv } from '../config/env';
import { getProject } from '../repositories/projects';
import { getDataset } from '../repositories/datasets';
import * as jobsRepo from '../repositories/jobs';
import * as analysisRepo from '../repositories/analyses';
import * as experimentRepo from '../repositories/experiments';
import { enqueueAnalyticsJob, removeQueuedJob, bullmqJobIdFor } from '../queue/analyticsQueue';
import {
  createJobSchema,
  jobIdParamSchema,
  listJobsQuerySchema,
  type CreateJobInput,
} from '../schemas/jobs';
import {
  ALLOWED_REGRESSION_MODELS,
  ALLOWED_CLASSIFICATION_MODELS,
} from '../schemas/experiments';
import type { Job, JobType } from '@nexusai/shared';

function respond(res: Response, data: unknown, status = 200): void {
  res.status(status).json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), version: 'v1' },
  });
}

function toZodDetails(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
}

async function requireOwnedProject(userId: string, projectId: string): Promise<void> {
  const project = await getProject(userId, projectId);
  if (!project) {
    throw AppError.notFound('PROJECT_NOT_FOUND', 'Project not found');
  }
}

async function requireReadyDatasetInProject(
  projectId: string,
  datasetId: string
): Promise<void> {
  const dataset = await getDataset(datasetId);
  if (!dataset || dataset.projectId !== projectId) {
    throw AppError.notFound('DATASET_NOT_FOUND', 'Dataset not found in this project');
  }
  if (dataset.status !== 'ready') {
    throw AppError.badRequest('DATASET_NOT_READY', 'Dataset is not ready');
  }
}

function checkModelAllowed(taskType: string, modelType: string): void {
  const allowed =
    taskType === 'regression' ? ALLOWED_REGRESSION_MODELS : ALLOWED_CLASSIFICATION_MODELS;
  if (!(allowed as readonly string[]).includes(modelType)) {
    throw AppError.badRequest('VALIDATION_ERROR', `modelType is not allowed for ${taskType}`);
  }
}

export async function createJob(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  const userId = req.user.id;
  const env = getEnv();

  let input: CreateJobInput;
  try {
    input = createJobSchema.parse(req.body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Invalid job data', {
        details: toZodDetails(error),
      });
    }
    throw error;
  }

  if (!env.REDIS_URL) {
    throw AppError.serviceUnavailable('QUEUE_UNAVAILABLE', 'Job queue is not configured');
  }

  // Authorize every referenced resource before persisting anything.
  const projectId = input.projectId;
  await requireOwnedProject(userId, projectId);
  await requireReadyDatasetInProject(projectId, input.datasetId);

  let entityId: string | undefined;
  let entityCleanup: (() => Promise<void>) | undefined;

  try {
    if (input.jobType === 'dataset.profile') {
      // No entity row needed; the result lives on the job itself.
    } else if (input.jobType === 'ml.train') {
      checkModelAllowed(input.taskType, input.modelType);
      if (input.targetColumn && input.featureColumns.includes(input.targetColumn)) {
        throw AppError.badRequest('VALIDATION_ERROR', 'targetColumn must not be in featureColumns');
      }
      if (input.experimentId) {
        const existing = await experimentRepo.getExperiment(input.experimentId);
        if (!existing || existing.projectId !== projectId) {
          throw AppError.notFound('EXPERIMENT_NOT_FOUND', 'Experiment not found');
        }
        if (existing.status === 'running' || existing.status === 'pending') {
          throw AppError.badRequest('EXPERIMENT_BUSY', 'Experiment is already running');
        }
        entityId = existing.id;
      } else {
        const created = await experimentRepo.createExperiment({
          projectId,
          datasetId: input.datasetId,
          userId,
          name:
            input.name?.trim() ? input.name.trim() : `${input.taskType} — ${input.modelType} — ${input.targetColumn}`,
          taskType: input.taskType,
          modelType: input.modelType,
          targetColumn: input.targetColumn,
          featureColumns: input.featureColumns,
          config: { testSize: input.testSize, randomState: input.randomState },
        });
        entityId = created.id;
        const createdId = created.id;
        entityCleanup = async () => {
          await experimentRepo.deleteExperiment(createdId).catch(() => undefined);
        };
      }
    } else {
      const analysisType = input.jobType.replace('analysis.', '');
      const created = await analysisRepo.createAnalysis({
        projectId,
        datasetId: input.datasetId,
        userId,
        analysisType: (analysisType === 'linear-algebra' ? 'linear_algebra' : analysisType) as
          | 'describe'
          | 'correlation'
          | 'covariance'
          | 'linear_algebra'
          | 'compare',
        engine: analysisType === 'compare' ? 'comparison' : 'julia',
        config: {
          columns: input.columns,
          missingPolicy: input.missingPolicy,
          maxRows: input.maxRows,
        },
      });
      entityId = created.id;
      const createdId = created.id;
      entityCleanup = async () => {
        await analysisRepo.deleteAnalysis(createdId).catch(() => undefined);
      };
    }

    const params: Record<string, unknown> = {
      projectId,
      datasetId: input.datasetId,
      ...(entityId ? { entityId } : {}),
    };
    if (input.jobType === 'ml.train') {
      params['taskType'] = input.taskType;
      params['modelType'] = input.modelType;
      params['targetColumn'] = input.targetColumn;
      params['featureColumns'] = input.featureColumns;
      params['testSize'] = input.testSize;
      params['randomState'] = input.randomState;
      if (input.experimentId) params['experimentId'] = input.experimentId;
    } else if (input.jobType !== 'dataset.profile') {
      params['analysisType'] = input.jobType.replace('analysis.', '').replace('linear-algebra', 'linear_algebra');
      if (input.columns) params['columns'] = input.columns;
      params['missingPolicy'] = input.missingPolicy;
      params['maxRows'] = input.maxRows;
    }

    // Persist the job row FIRST so a crash between DB and Redis is recoverable:
    // the row exists in `queued` and reconciliation can re-enqueue it.
    const id = randomUUID();
    const bullmqJobId = bullmqJobIdFor(id);
    const row = await jobsRepo.createJob({
      userId,
      projectId,
      datasetId: input.datasetId,
      jobType: input.jobType,
      params,
      maxAttempts: env.JOB_MAX_ATTEMPTS,
      bullmqJobId,
    }).catch(async (error: unknown) => {
      // utils-made id collision is practically impossible; still compensate entity.
      if (entityCleanup) await entityCleanup();
      throw error;
    });

    try {
      await enqueueAnalyticsJob(row.id, input.jobType as JobType, {
        userId,
        projectId,
        datasetId: input.datasetId,
        params,
      });
    } catch (error) {
      // Enqueue failed: mark the row failed AND remove the pending entity so
      // no orphaned `pending` rows linger.
      await jobsRepo.markJobFailed(row.id, 'QUEUE_ERROR', 'Failed to enqueue job').catch(() => undefined);
      if (entityCleanup) await entityCleanup();
      logger.error('Failed to enqueue job', { jobRowId: row.id }, error instanceof Error ? error : undefined);
      throw AppError.serviceUnavailable('QUEUE_UNAVAILABLE', 'Job queue is unavailable');
    }

    const created = await jobsRepo.getJob(row.id);
    respond(res, created, 202);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Unexpected job creation failure', {}, error instanceof Error ? error : undefined);
    throw AppError.internal('JOB_CREATION_FAILED', 'Failed to create job');
  }
}

export async function listJobs(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  let query;
  try {
    query = listJobsQuerySchema.parse(req.query);
  } catch (error) {
    if (error instanceof ZodError) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Invalid query', { details: toZodDetails(error) });
    }
    throw error;
  }
  if (query.projectId) {
    await requireOwnedProject(req.user.id, query.projectId);
  }
  const { jobs, total } = await jobsRepo.listOwnedJobs(
    req.user.id,
    { status: query.status, jobType: query.jobType, projectId: query.projectId },
    query.page,
    query.limit
  );
  respond(res, {
    jobs,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  });
}

export async function getJobById(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  const { jobId } = jobIdParamSchema.parse(req.params);
  const job: Job | null = await jobsRepo.getOwnedJob(req.user.id, jobId);
  if (!job) {
    throw AppError.notFound('JOB_NOT_FOUND', 'Job not found');
  }
  respond(res, job);
}

export async function cancelJob(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  const { jobId } = jobIdParamSchema.parse(req.params);
  const job: Job | null = await jobsRepo.getOwnedJob(req.user.id, jobId);
  if (!job) {
    throw AppError.notFound('JOB_NOT_FOUND', 'Job not found');
  }

  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    throw AppError.badRequest('JOB_NOT_CANCELLABLE', `Job is already ${job.status}`);
  }

  if (job.status === 'queued') {
    // Safe removal: the job never started.
    const removed = job.bullmqJobId ? await removeQueuedJob(job.bullmqJobId).catch(() => false) : false;
    void removed;
    const ok = await jobsRepo.markJobCancelled(job.id);
    if (!ok) {
      throw AppError.badRequest('JOB_NOT_CANCELLABLE', 'Job changed state; refresh and retry');
    }
    const updated = await jobsRepo.getOwnedJob(req.user.id, jobId);
    respond(res, updated);
    return;
  }

  // Active (or already cancel-requested): cooperative cancellation. The worker
  // observes the flag before publishing results. In-flight Python/Julia HTTP
  // calls cannot be safely interrupted mid-computation — documented limit.
  const ok = await jobsRepo.requestJobCancel(job.id);
  if (!ok) {
    throw AppError.badRequest('JOB_NOT_CANCELLABLE', 'Job changed state; refresh and retry');
  }
  const updated = await jobsRepo.getOwnedJob(req.user.id, jobId);
  respond(res, updated);
}
