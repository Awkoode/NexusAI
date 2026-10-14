import { Queue, type JobsOptions } from 'bullmq';
import { getRedisConnection } from './connection';
import { getEnv } from '../config/env';
import type { JobType } from '@nexusai/shared';

export const ANALYTICS_QUEUE_NAME = 'nexusai-analytics';

export interface AnalyticsJobData {
  /** UUID of the `jobs` row (also the idempotency key). */
  jobId: string;
  userId: string;
  jobType: JobType;
  projectId?: string;
  datasetId?: string;
  /** Validated operation params (identifiers + scalars only). */
  params: Record<string, unknown>;
}

let queue: Queue<AnalyticsJobData> | null = null;

export function getAnalyticsQueue(): Queue<AnalyticsJobData> {
  if (queue) return queue;
  queue = new Queue<AnalyticsJobData>(ANALYTICS_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });
  return queue;
}

/** Deterministic BullMQ jobId derived from the DB row — re-adding is a no-op dedupe. */
export function bullmqJobIdFor(jobId: string): string {
  return `job:${jobId}`;
}

export async function enqueueAnalyticsJob(
  jobId: string,
  jobType: JobType,
  data: Omit<AnalyticsJobData, 'jobId' | 'jobType'>
): Promise<string> {
  const env = getEnv();
  const bullmqJobId = bullmqJobIdFor(jobId);
  const options: JobsOptions = {
    jobId: bullmqJobId,
    attempts: env.JOB_MAX_ATTEMPTS,
    backoff: { type: 'exponential', delay: env.JOB_BACKOFF_MS },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  };
  const job = await getAnalyticsQueue().add(
    jobType,
    { ...data, jobId, jobType },
    options
  );
  return job.id ?? bullmqJobId;
}

export async function removeQueuedJob(bullmqJobId: string): Promise<boolean> {
  const job = await getAnalyticsQueue().getJob(bullmqJobId);
  if (!job) return false;
  const state = await job.getState();
  // Only safe to remove jobs that never started.
  if (state === 'waiting' || state === 'delayed' || state === 'prioritized') {
    await job.remove();
    return true;
  }
  return false;
}

export async function closeAnalyticsQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}

/** Test-only hook. */
export function resetAnalyticsQueue(): void {
  queue = null;
}
