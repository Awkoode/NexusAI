import { type Job, UnrecoverableError, Worker } from 'bullmq';
import { getEnv } from '../config/env';
import { logger } from '../utils/logger';
import { getRedisConnection } from './connection';
import {
  ANALYTICS_QUEUE_NAME,
  type AnalyticsJobData,
  bullmqJobIdFor,
  getAnalyticsQueue,
} from './analyticsQueue';
import * as jobsRepo from '../repositories/jobs';
import * as analysisRepo from '../repositories/analyses';
import * as experimentRepo from '../repositories/experiments';
import { getProject } from '../repositories/projects';
import { executeAnalysisJob } from '../services/analysisRunner';
import { executeTraining } from '../services/trainingRunner';
import { profileDataset } from '../services/datasetProfiler';
import { AppError } from '../middleware/errorHandler';
import type { Job as JobRow } from '@nexusai/shared';

export const RECOVERY_STALE_SECONDS = 300;

async function reportProgress(jobRowId: string, progress: number, stage: string): Promise<void> {
  await jobsRepo.updateJobProgress(jobRowId, progress, stage).catch((error: unknown) => {
    logger.error('Failed to persist job progress', { jobRowId }, error instanceof Error ? error : undefined);
  });
}

/** True when the user asked for cancellation — worker must not publish results. */
async function isCancelRequested(jobRowId: string): Promise<boolean> {
  const row = await jobsRepo.getJob(jobRowId).catch(() => null);
  return row?.status === 'cancel_requested' || row?.status === 'cancelled';
}

function toSafeMessage(message: string): string {
  return message.slice(0, 2000);
}

/**
 * Permanent failures (bad input, permission, unknown entities) must NOT be
 * retried. Everything else (timeouts, 5xx, storage/DB blips) is transient.
 */
export function isPermanentError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.statusCode >= 400 && error.statusCode < 500;
  }
  // Service clients already map 422 → AppError(400); anything reaching here
  // with an explicit permanent marker stays permanent.
  return false;
}

async function failJobAndEntities(
  jobRow: JobRow,
  params: AnalyticsJobData,
  code: string,
  message: string
): Promise<void> {
  const safe = toSafeMessage(message);
  await jobsRepo.markJobFailed(jobRow.id, code, safe);
  const entityId = params.params['entityId'] as string | undefined;
  if (!entityId) return;
  try {
    if (params.jobType === 'ml.train') {
      await experimentRepo.markExperimentFailed(entityId, safe);
    } else if (params.jobType.startsWith('analysis.')) {
      await analysisRepo.failAnalysis(entityId, safe);
    }
  } catch (error) {
    logger.error('Failed to mark entity as failed', { jobRowId: jobRow.id }, error instanceof Error ? error : undefined);
  }
}

async function processAnalysisJob(
  jobRow: JobRow,
  userId: string,
  params: AnalyticsJobData
): Promise<Record<string, unknown>> {
  const p = params.params;
  const analysisType = (p['analysisType'] ?? '') as string;
  const { result } = await executeAnalysisJob(
    userId,
    {
      analysisType: analysisType as 'describe' | 'correlation' | 'covariance' | 'linear_algebra' | 'compare',
      projectId: (p['projectId'] ?? params.projectId ?? '') as string,
      datasetId: (p['datasetId'] ?? params.datasetId ?? '') as string,
      columns: p['columns'] as string[] | undefined,
      missingPolicy: (p['missingPolicy'] as 'pairwise' | 'listwise' | undefined) ?? 'pairwise',
      maxRows: (p['maxRows'] as number | undefined) ?? 5000,
    },
    (progress, stage) => reportProgress(jobRow.id, 15 + Math.round(progress * 0.7), stage)
  );
  // Mirror into analysis_runs so sync/async share one history.
  const entityId = params.params['entityId'] as string | undefined;
  if (entityId) {
    await analysisRepo.completeAnalysis(entityId, result).catch((error: unknown) => {
      logger.error('Failed to mirror analysis result', { jobRowId: jobRow.id }, error instanceof Error ? error : undefined);
    });
  }
  return result;
}

async function processTrainJob(
  jobRow: JobRow,
  userId: string,
  params: AnalyticsJobData
): Promise<Record<string, unknown>> {
  const p = params.params;
  const projectId = (p['projectId'] ?? params.projectId ?? '') as string;
  const datasetId = (p['datasetId'] ?? params.datasetId ?? '') as string;

  // Reuse the exact sync execution path (creates its own model_runs row).
  const project = await getProject(userId, projectId);
  if (!project) {
    throw AppError.notFound('PROJECT_NOT_FOUND', 'Project not found');
  }

  let experimentId = p['experimentId'] as string | undefined;
  if (experimentId) {
    const existing = await experimentRepo.getExperiment(experimentId);
    if (!existing || existing.projectId !== projectId) {
      throw AppError.notFound('EXPERIMENT_NOT_FOUND', 'Experiment not found');
    }
    if (existing.status === 'running' || existing.status === 'pending') {
      throw AppError.badRequest('EXPERIMENT_BUSY', 'Experiment is already running');
    }
  } else {
    const taskType = p['taskType'] as string;
    const modelType = p['modelType'] as string;
    const targetColumn = p['targetColumn'] as string;
    const featureColumns = p['featureColumns'] as string[];
    if (!taskType || !modelType || !targetColumn || !featureColumns) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Missing training parameters');
    }
    const created = await experimentRepo.createExperiment({
      projectId,
      datasetId,
      userId,
      name: ((p['name'] as string) ?? '').trim() || `${taskType} — ${modelType} — ${targetColumn}`,
      taskType,
      modelType,
      targetColumn,
      featureColumns,
      config: {
        testSize: (p['testSize'] as number | undefined) ?? 0.2,
        randomState: (p['randomState'] as number | undefined) ?? 42,
      },
    });
    experimentId = created.id;
  }

  const experiment = await experimentRepo.getExperiment(experimentId);
  if (!experiment) {
    throw AppError.notFound('EXPERIMENT_NOT_FOUND', 'Experiment not found');
  }
  const completed = await executeTraining(experiment, (progress, stage) =>
    reportProgress(jobRow.id, 15 + Math.round(progress * 0.7), stage)
  );
  const latestRun = await experimentRepo.getLatestRun(completed.id);
  return { experimentId: completed.id, status: completed.status, latestRun };
}

async function processProfileJob(
  jobRow: JobRow,
  userId: string,
  params: AnalyticsJobData
): Promise<Record<string, unknown>> {
  const p = params.params;
  const projectId = (p['projectId'] ?? params.projectId ?? '') as string;
  const datasetId = (p['datasetId'] ?? params.datasetId ?? '') as string;
  return profileDataset(userId, projectId, datasetId, (progress, stage) =>
    reportProgress(jobRow.id, 15 + Math.round(progress * 0.7), stage)
  );
}

/**
 * BullMQ processor. Throws AppError for permanent failures (mapped to
 * UnrecoverableError — no retry) and lets transient errors retry with
 * exponential backoff per queue defaults.
 */
export async function processAnalyticsJob(job: Job<AnalyticsJobData>): Promise<Record<string, unknown>> {
  const params = job.data;
  const logContext = { bullmqJobId: job.id ?? 'unknown', jobType: params.jobType };

  const jobRow = await jobsRepo.getJob(params.jobId);
  if (!jobRow) {
    // Orphan BullMQ job without a DB row — fail loudly, do not retry.
    throw new UnrecoverableError(`No jobs row for ${params.jobId}`);
  }
  if (jobRow.userId !== params.userId) {
    throw new UnrecoverableError('Job owner mismatch');
  }
  if (await isCancelRequested(jobRow.id)) {
    await jobsRepo.markJobCancelled(jobRow.id);
    logger.info('Job already cancelled before start', { ...logContext, jobRowId: jobRow.id });
    return { cancelled: true };
  }

  await jobsRepo.markJobActive(jobRow.id);
  logger.info('Job started', { ...logContext, jobRowId: jobRow.id, attempt: job.attemptsMade + 1 });

  try {
    await reportProgress(jobRow.id, 10, 'started');
    let result: Record<string, unknown>;

    if (params.jobType === 'dataset.profile') {
      result = await processProfileJob(jobRow, params.userId, params);
    } else if (params.jobType === 'ml.train') {
      result = await processTrainJob(jobRow, params.userId, params);
    } else {
      result = await processAnalysisJob(jobRow, params.userId, params);
    }

    // Cooperative cancellation: never publish results after a confirmed cancel.
    if (await isCancelRequested(jobRow.id)) {
      await jobsRepo.markJobCancelled(jobRow.id);
      await failJobAndEntities(jobRow, params, 'CANCELLED', 'Cancelled by user');
      logger.info('Job cancelled during execution; results discarded', { ...logContext, jobRowId: jobRow.id });
      return { cancelled: true };
    }

    await reportProgress(jobRow.id, 95, 'persisting');
    await jobsRepo.markJobCompleted(jobRow.id, result);

    logger.info('Job completed', { ...logContext, jobRowId: jobRow.id });
    return { jobRowId: jobRow.id };
  } catch (error) {
    if (await isCancelRequested(jobRow.id)) {
      await jobsRepo.markJobCancelled(jobRow.id);
      return { cancelled: true };
    }
    if (isPermanentError(error)) {
      const message = error instanceof AppError ? error.message : 'Invalid job';
      const code = error instanceof AppError ? error.code : 'PERMANENT_ERROR';
      await failJobAndEntities(jobRow, params, code, message);
      throw new UnrecoverableError(`${code}: ${message}`);
    }
    // Transient failure: record the retry stage and rethrow. BullMQ owns the
    // retry budget authoritatively; the worker-level 'failed' listener below
    // persists the terminal state only when retries are truly exhausted.
    // (Note: on some Redis versions attemptsMade is already >= 1 on first
    // delivery, so this code MUST NOT decide exhaustion itself.)
    await reportProgress(jobRow.id, 10, `retrying (attempt ${job.attemptsMade + 1})`);
    throw error;
  }
}

/**
 * Recovery: re-enqueue DB-active jobs left behind by a crashed worker.
 * Uses the deterministic jobId so already-queued jobs are never duplicated.
 */
export async function recoverOrphanedJobs(olderThanSeconds = RECOVERY_STALE_SECONDS): Promise<number> {
  const orphans = await jobsRepo.findOrphanedActive(olderThanSeconds);
  let recovered = 0;
  for (const row of orphans) {
    try {
      const queue = getAnalyticsQueue();
      const bullmqJobId = row.bullmqJobId ?? bullmqJobIdFor(row.id);
      const existing = await queue.getJob(bullmqJobId);
      if (existing) {
        const state = await existing.getState();
        if (state === 'active' || state === 'waiting' || state === 'delayed' || state === 'prioritized') {
          continue; // BullMQ still owns it — leave it alone.
        }
      }
      const requeued = await jobsRepo.requeueJob(row.id);
      if (!requeued) continue;
      await queue.add(
        row.jobType,
        {
          jobId: row.id,
          userId: row.userId,
          jobType: row.jobType,
          projectId: row.projectId ?? undefined,
          datasetId: row.datasetId ?? undefined,
          params: (row.params ?? {}) as Record<string, unknown>,
        },
        { jobId: bullmqJobId }
      );
      recovered++;
      logger.info('Recovered orphaned job', { jobRowId: row.id });
    } catch (error) {
      logger.error('Failed to recover job', { jobRowId: row.id }, error instanceof Error ? error : undefined);
    }
  }
  return recovered;
}

let worker: Worker<AnalyticsJobData> | null = null;

export function getWorker(): Worker<AnalyticsJobData> | null {
  return worker;
}

export function startWorker(): Worker<AnalyticsJobData> {
  if (worker) return worker;
  const env = getEnv();

  worker = new Worker<AnalyticsJobData>(ANALYTICS_QUEUE_NAME, processAnalyticsJob, {
    connection: getRedisConnection(),
    concurrency: env.WORKER_CONCURRENCY,
  });

  worker.on('completed', (job) => {
    logger.info('BullMQ job completed', { bullmqJobId: job.id ?? 'unknown' });
  });
  worker.on('failed', (job, error) => {
    logger.warn('BullMQ job failed', { bullmqJobId: job?.id ?? 'unknown', message: error.message });
    // Terminal failure (retries exhausted or unrecoverable): persist it unless
    // the row already reached a terminal state (e.g. cancelled concurrently).
    void (async () => {
      try {
        const data = job?.data;
        if (!job || !data?.jobId) return;
        const row = await jobsRepo.getJob(data.jobId).catch(() => null);
        if (!row) return;
        if (row.status === 'completed' || row.status === 'failed' || row.status === 'cancelled') {
          return;
        }
        const message = toSafeMessage(error.message || 'Job failed');
        const code = /^([A-Z_]+):/.exec(message)?.[1] ?? 'JOB_FAILED';
        await failJobAndEntities(row, data, code, message.replace(/^([A-Z_]+):\s*/, ''));
      } catch (handlerError) {
        logger.error(
          'Failed to persist terminal job failure',
          {},
          handlerError instanceof Error ? handlerError : undefined
        );
      }
    })();
  });
  worker.on('error', (error) => {
    logger.error('Worker error', {}, error instanceof Error ? error : undefined);
  });

  logger.info('Worker started', { concurrency: env.WORKER_CONCURRENCY, queue: ANALYTICS_QUEUE_NAME });
  return worker;
}

export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info('Worker stopped');
  }
}
