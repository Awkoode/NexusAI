-- Migration: 003_experiments
-- Created at: 2026-10-14
-- Description: Creates experiments and model_runs tables for ML Phase 4

-- UP

CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  task_type VARCHAR(30) NOT NULL CHECK (task_type IN ('regression', 'classification')),
  model_type VARCHAR(64) NOT NULL,
  target_column VARCHAR(200) NOT NULL,
  feature_columns JSONB NOT NULL,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_experiments_project_id ON experiments(project_id);
CREATE INDEX IF NOT EXISTS idx_experiments_dataset_id ON experiments(dataset_id);
CREATE INDEX IF NOT EXISTS idx_experiments_user_id ON experiments(user_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_created_at ON experiments(created_at DESC);

DROP TRIGGER IF EXISTS update_experiments_updated_at ON experiments;
CREATE TRIGGER update_experiments_updated_at
  BEFORE UPDATE ON experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS model_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  metrics_json JSONB,
  train_samples INTEGER,
  test_samples INTEGER,
  model_params_json JSONB,
  predictions_summary_json JSONB,
  train_seconds DOUBLE PRECISION,
  library_versions_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_model_runs_experiment_id ON model_runs(experiment_id);
CREATE INDEX IF NOT EXISTS idx_model_runs_created_at ON model_runs(created_at DESC);

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_runs ENABLE ROW LEVEL SECURITY;

-- Experiments: owners manage their own rows via project ownership.
CREATE POLICY "Users can view own experiments" ON experiments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = experiments.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own experiments" ON experiments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = experiments.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own experiments" ON experiments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = experiments.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own experiments" ON experiments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = experiments.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Model runs inherit visibility from their experiment's project.
CREATE POLICY "Users can view own model runs" ON model_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments
      JOIN projects ON projects.id = experiments.project_id
      WHERE experiments.id = model_runs.experiment_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own model runs" ON model_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM experiments
      JOIN projects ON projects.id = experiments.project_id
      WHERE experiments.id = model_runs.experiment_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own model runs" ON model_runs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM experiments
      JOIN projects ON projects.id = experiments.project_id
      WHERE experiments.id = model_runs.experiment_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own model runs" ON model_runs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM experiments
      JOIN projects ON projects.id = experiments.project_id
      WHERE experiments.id = model_runs.experiment_id
        AND projects.user_id = auth.uid()
    )
  );

-- DOWN
DROP POLICY IF EXISTS "Users can delete own model runs" ON model_runs;
DROP POLICY IF EXISTS "Users can update own model runs" ON model_runs;
DROP POLICY IF EXISTS "Users can insert own model runs" ON model_runs;
DROP POLICY IF EXISTS "Users can view own model runs" ON model_runs;
DROP POLICY IF EXISTS "Users can delete own experiments" ON experiments;
DROP POLICY IF EXISTS "Users can update own experiments" ON experiments;
DROP POLICY IF EXISTS "Users can insert own experiments" ON experiments;
DROP POLICY IF EXISTS "Users can view own experiments" ON experiments;
ALTER TABLE model_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE experiments DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS update_experiments_updated_at ON experiments;
DROP INDEX IF EXISTS idx_model_runs_created_at;
DROP INDEX IF EXISTS idx_model_runs_experiment_id;
DROP INDEX IF EXISTS idx_experiments_created_at;
DROP INDEX IF EXISTS idx_experiments_status;
DROP INDEX IF EXISTS idx_experiments_user_id;
DROP INDEX IF EXISTS idx_experiments_dataset_id;
DROP INDEX IF EXISTS idx_experiments_project_id;
DROP TABLE IF EXISTS model_runs;
DROP TABLE IF EXISTS experiments;