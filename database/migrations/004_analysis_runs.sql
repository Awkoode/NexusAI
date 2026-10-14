-- Migration: 004_analysis_runs
-- Created at: 2026-10-14
-- Description: Stores statistical analyses (Julia/Python) and comparisons

CREATE TABLE IF NOT EXISTS analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_type VARCHAR(40) NOT NULL
    CHECK (analysis_type IN ('describe', 'correlation', 'covariance', 'linear_algebra', 'compare')),
  engine VARCHAR(20) NOT NULL
    CHECK (engine IN ('julia', 'python', 'comparison')),
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  result_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_project_id ON analysis_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_dataset_id ON analysis_runs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_user_id ON analysis_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_type ON analysis_runs(analysis_type);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_created_at ON analysis_runs(created_at DESC);

ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses" ON analysis_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = analysis_runs.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own analyses" ON analysis_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = analysis_runs.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own analyses" ON analysis_runs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = analysis_runs.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own analyses" ON analysis_runs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = analysis_runs.project_id
        AND projects.user_id = auth.uid()
    )
  );
