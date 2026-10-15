-- Migration: 005_jobs
-- Created at: 2026-10-14
-- Description: Generic async job records for the BullMQ analytics queue.
--
-- Design notes:
-- - One row per unit of queued work. The BullMQ jobId is deterministic
--   (`job:<id>`) so re-enqueueing the same row can never duplicate work.
-- - Payloads carry ONLY identifiers + validated params (never CSV content,
--   tokens, or secrets).
-- - `status` mirrors the BullMQ lifecycle plus explicit `cancel_requested`
--   for cooperative cancellation of running jobs.
-- - Terminal states: completed, failed, cancelled.

-- UP

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
  job_type VARCHAR(60) NOT NULL
    CHECK (job_type IN (
      'dataset.profile',
      'ml.train',
      'analysis.describe',
      'analysis.correlation',
      'analysis.covariance',
      'analysis.linear-algebra',
      'analysis.compare'
    )),
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued', 'active', 'completed', 'failed', 'cancelled', 'cancel_requested'
    )),
  params_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  stage VARCHAR(100),
  result_json JSONB,
  error_code VARCHAR(100),
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  bullmq_job_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_dataset_id ON jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_bullmq_job_id ON jobs(bullmq_job_id);

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs" ON jobs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own jobs" ON jobs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own jobs" ON jobs
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own jobs" ON jobs
  FOR DELETE USING (user_id = auth.uid());

-- DOWN
DROP POLICY IF EXISTS "Users can delete own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can update own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can insert own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can view own jobs" ON jobs;
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
DROP INDEX IF EXISTS idx_jobs_bullmq_job_id;
DROP INDEX IF EXISTS idx_jobs_created_at;
DROP INDEX IF EXISTS idx_jobs_type;
DROP INDEX IF EXISTS idx_jobs_status;
DROP INDEX IF EXISTS idx_jobs_dataset_id;
DROP INDEX IF EXISTS idx_jobs_project_id;
DROP INDEX IF EXISTS idx_jobs_user_id;
DROP TABLE IF EXISTS jobs;