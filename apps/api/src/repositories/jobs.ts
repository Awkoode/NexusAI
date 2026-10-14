import { getPool } from './projects';
import type { Job } from '@nexusai/shared';

const QUERIES = {
  CREATE: `
    INSERT INTO jobs
      (user_id, project_id, dataset_id, job_type, status, params_json, max_attempts, bullmq_job_id)
    VALUES ($1, $2, $3, $4, 'queued', $5, $6, $7)
    RETURNING id, user_id AS "userId", project_id AS "projectId",
              dataset_id AS "datasetId", job_type AS "jobType", status,
              params_json AS "params", progress, stage,
              result_json AS "result", error_code AS "errorCode",
              error_message AS "errorMessage", attempts,
              max_attempts AS "maxAttempts", bullmq_job_id AS "bullmqJobId",
              created_at AS "createdAt", updated_at AS "updatedAt",
              started_at AS "startedAt", completed_at AS "completedAt"
  `,
  GET_BY_ID: `
    SELECT id, user_id AS "userId", project_id AS "projectId",
           dataset_id AS "datasetId", job_type AS "jobType", status,
           params_json AS "params", progress, stage,
           result_json AS "result", error_code AS "errorCode",
           error_message AS "errorMessage", attempts,
           max_attempts AS "maxAttempts", bullmq_job_id AS "bullmqJobId",
           created_at AS "createdAt", updated_at AS "updatedAt",
           started_at AS "startedAt", completed_at AS "completedAt"
    FROM jobs
    WHERE id = $1
  `,
  GET_OWNED: `
    SELECT id, user_id AS "userId", project_id AS "projectId",
           dataset_id AS "datasetId", job_type AS "jobType", status,
           params_json AS "params", progress, stage,
           result_json AS "result", error_code AS "errorCode",
           error_message AS "errorMessage", attempts,
           max_attempts AS "maxAttempts", bullmq_job_id AS "bullmqJobId",
           created_at AS "createdAt", updated_at AS "updatedAt",
           started_at AS "startedAt", completed_at AS "completedAt"
    FROM jobs
    WHERE id = $1 AND user_id = $2
  `,
  LIST_OWNED: `
    SELECT id, user_id AS "userId", project_id AS "projectId",
           dataset_id AS "datasetId", job_type AS "jobType", status,
           params_json AS "params", progress, stage,
           result_json AS "result", error_code AS "errorCode",
           error_message AS "errorMessage", attempts,
           max_attempts AS "maxAttempts", bullmq_job_id AS "bullmqJobId",
           created_at AS "createdAt", updated_at AS "updatedAt",
           started_at AS "startedAt", completed_at AS "completedAt"
    FROM jobs
    WHERE user_id = $1
      AND ($2::text IS NULL OR status = $2)
      AND ($3::text IS NULL OR job_type = $3)
      AND ($4::uuid IS NULL OR project_id = $4)
    ORDER BY created_at DESC
    LIMIT $5 OFFSET $6
  `,
  COUNT_OWNED: `
    SELECT COUNT(*)::int AS count
    FROM jobs
    WHERE user_id = $1
      AND ($2::text IS NULL OR status = $2)
      AND ($3::text IS NULL OR job_type = $3)
      AND ($4::uuid IS NULL OR project_id = $4)
  `,
  MARK_ACTIVE: `
    UPDATE jobs
    SET status = 'active', started_at = COALESCE(started_at, NOW()),
        attempts = attempts + 1, progress = 5, stage = 'active'
    WHERE id = $1
    RETURNING id, status
  `,
  UPDATE_PROGRESS: `
    UPDATE jobs
    SET progress = $2, stage = $3
    WHERE id = $1
  `,
  MARK_COMPLETED: `
    UPDATE jobs
    SET status = 'completed', progress = 100, stage = 'completed',
        result_json = $2, completed_at = NOW()
    WHERE id = $1
    RETURNING id, status
  `,
  MARK_FAILED: `
    UPDATE jobs
    SET status = 'failed', error_code = $2, error_message = $3, completed_at = NOW()
    WHERE id = $1
    RETURNING id, status
  `,
  MARK_CANCELLED: `
    UPDATE jobs
    SET status = 'cancelled', completed_at = NOW()
    WHERE id = $1 AND status IN ('queued', 'active', 'cancel_requested')
    RETURNING id, status
  `,
  REQUEST_CANCEL: `
    UPDATE jobs
    SET status = 'cancel_requested'
    WHERE id = $1 AND status IN ('queued', 'active')
    RETURNING id, status
  `,
  /** Jobs left active by a crashed worker — candidates for recovery. */
  FIND_ORPHANED_ACTIVE: `
    SELECT id, user_id AS "userId", project_id AS "projectId",
           dataset_id AS "datasetId", job_type AS "jobType", status,
           params_json AS "params", progress, stage,
           result_json AS "result", error_code AS "errorCode",
           error_message AS "errorMessage", attempts,
           max_attempts AS "maxAttempts", bullmq_job_id AS "bullmqJobId",
           created_at AS "createdAt", updated_at AS "updatedAt",
           started_at AS "startedAt", completed_at AS "completedAt"
    FROM jobs
    WHERE status = 'active' AND updated_at < NOW() - ($1 || ' seconds')::interval
  `,
  REQUEUE: `
    UPDATE jobs
    SET status = 'queued', progress = 0, stage = 'requeued-after-recovery'
    WHERE id = $1 AND status = 'active'
    RETURNING id, status
  `,
} as const;

export async function createJob(data: {
  userId: string;
  projectId?: string;
  datasetId?: string;
  jobType: string;
  params: Record<string, unknown>;
  maxAttempts: number;
  bullmqJobId: string;
}): Promise<Job> {
  const pool = getPool();
  try {
    const result = await pool.query<Job>(QUERIES.CREATE, [
      data.userId,
      data.projectId ?? null,
      data.datasetId ?? null,
      data.jobType,
      JSON.stringify(data.params),
      data.maxAttempts,
      data.bullmqJobId,
    ]);
    return result.rows[0]!;
  } finally {
    await pool.end();
  }
}

export async function getJob(jobId: string): Promise<Job | null> {
  const pool = getPool();
  try {
    const result = await pool.query<Job>(QUERIES.GET_BY_ID, [jobId]);
    return result.rows[0] ?? null;
  } finally {
    await pool.end();
  }
}

export async function getOwnedJob(userId: string, jobId: string): Promise<Job | null> {
  const pool = getPool();
  try {
    const result = await pool.query<Job>(QUERIES.GET_OWNED, [jobId, userId]);
    return result.rows[0] ?? null;
  } finally {
    await pool.end();
  }
}

export async function listOwnedJobs(
  userId: string,
  filters: { status?: string; jobType?: string; projectId?: string },
  page: number,
  limit: number
): Promise<{ jobs: Job[]; total: number }> {
  const pool = getPool();
  try {
    const offset = (page - 1) * limit;
    const [rows, counted] = await Promise.all([
      pool.query<Job>(QUERIES.LIST_OWNED, [
        userId,
        filters.status ?? null,
        filters.jobType ?? null,
        filters.projectId ?? null,
        limit,
        offset,
      ]),
      pool.query<{ count: number }>(QUERIES.COUNT_OWNED, [
        userId,
        filters.status ?? null,
        filters.jobType ?? null,
        filters.projectId ?? null,
      ]),
    ]);
    return { jobs: rows.rows, total: counted.rows[0]?.count ?? 0 };
  } finally {
    await pool.end();
  }
}

export async function markJobActive(jobId: string): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(QUERIES.MARK_ACTIVE, [jobId]);
  } finally {
    await pool.end();
  }
}

export async function updateJobProgress(jobId: string, progress: number, stage: string): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(QUERIES.UPDATE_PROGRESS, [jobId, progress, stage]);
  } finally {
    await pool.end();
  }
}

export async function markJobCompleted(jobId: string, result: Record<string, unknown>): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(QUERIES.MARK_COMPLETED, [jobId, JSON.stringify(result)]);
  } finally {
    await pool.end();
  }
}

export async function markJobFailed(jobId: string, code: string, message: string): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(QUERIES.MARK_FAILED, [jobId, code, message.slice(0, 2000)]);
  } finally {
    await pool.end();
  }
}

export async function markJobCancelled(jobId: string): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(QUERIES.MARK_CANCELLED, [jobId]);
    return (result.rowCount ?? 0) > 0;
  } finally {
    await pool.end();
  }
}

export async function requestJobCancel(jobId: string): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(QUERIES.REQUEST_CANCEL, [jobId]);
    return (result.rowCount ?? 0) > 0;
  } finally {
    await pool.end();
  }
}

export async function findOrphanedActive(olderThanSeconds: number): Promise<Job[]> {
  const pool = getPool();
  try {
    const result = await pool.query<Job>(QUERIES.FIND_ORPHANED_ACTIVE, [olderThanSeconds]);
    return result.rows;
  } finally {
    await pool.end();
  }
}

export async function requeueJob(jobId: string): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(QUERIES.REQUEUE, [jobId]);
    return (result.rowCount ?? 0) > 0;
  } finally {
    await pool.end();
  }
}
