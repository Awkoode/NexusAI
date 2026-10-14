-- Migration: 002_datasets
-- Created at: 2026-10-14
-- Description: Creates datasets table for CSV file storage metadata

CREATE TABLE IF NOT EXISTS datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  row_count INTEGER,
  column_count INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'ready', 'failed')),
  error_message TEXT,
  schema_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_datasets_project_id ON datasets(project_id);
CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_status ON datasets(status);
CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON datasets(created_at DESC);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_datasets_updated_at ON datasets;
CREATE TRIGGER update_datasets_updated_at
  BEFORE UPDATE ON datasets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;

-- Users can view datasets in their own projects
CREATE POLICY "Users can view own project datasets" ON datasets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = datasets.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Users can insert datasets into their own projects
CREATE POLICY "Users can insert own project datasets" ON datasets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = datasets.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Users can update their own project datasets
CREATE POLICY "Users can update own project datasets" ON datasets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = datasets.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Users can delete their own project datasets
CREATE POLICY "Users can delete own project datasets" ON datasets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = datasets.project_id
        AND projects.user_id = auth.uid()
    )
  );
