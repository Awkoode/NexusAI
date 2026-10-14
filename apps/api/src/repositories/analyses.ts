import { getPool } from './projects';
import type { AnalysisRun } from '@nexusai/shared';

const QUERIES = {
  LIST_BY_PROJECT: `
    SELECT id, project_id AS "projectId", dataset_id AS "datasetId",
           user_id AS "userId", analysis_type AS "analysisType",
           engine, config_json AS "config", status,
           result_json AS "result", error_message AS "errorMessage",
           created_at AS "createdAt", completed_at AS "completedAt"
    FROM analysis_runs
    WHERE project_id = $1
    ORDER BY created_at DESC
  `,
  GET_BY_ID: `
    SELECT id, project_id AS "projectId", dataset_id AS "datasetId",
           user_id AS "userId", analysis_type AS "analysisType",
           engine, config_json AS "config", status,
           result_json AS "result", error_message AS "errorMessage",
           created_at AS "createdAt", completed_at AS "completedAt"
    FROM analysis_runs
    WHERE id = $1
  `,
  CREATE: `
    INSERT INTO analysis_runs
      (project_id, dataset_id, user_id, analysis_type, engine, config_json, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'running')
    RETURNING id, project_id AS "projectId", dataset_id AS "datasetId",
              analysis_type AS "analysisType", engine,
              config_json AS "config", status,
              created_at AS "createdAt"
  `,
  COMPLETE: `
    UPDATE analysis_runs
    SET status = 'completed', result_json = $2, completed_at = NOW()
    WHERE id = $1
    RETURNING id, status, result_json AS "result", completed_at AS "completedAt"
  `,
  FAIL: `
    UPDATE analysis_runs
    SET status = 'failed', error_message = $2, completed_at = NOW()
    WHERE id = $1
    RETURNING id, status
  `,
  DELETE: `DELETE FROM analysis_runs WHERE id = $1`,
} as const;

export async function listAnalysesByProject(projectId: string): Promise<AnalysisRun[]> {
  const pool = getPool();
  try {
    const result = await pool.query<AnalysisRun>(QUERIES.LIST_BY_PROJECT, [projectId]);
    return result.rows;
  } finally {
    await pool.end();
  }
}

export async function getAnalysis(analysisId: string): Promise<AnalysisRun | null> {
  const pool = getPool();
  try {
    const result = await pool.query<AnalysisRun>(QUERIES.GET_BY_ID, [analysisId]);
    return result.rows[0] ?? null;
  } finally {
    await pool.end();
  }
}

export async function createAnalysis(data: {
  projectId: string;
  datasetId: string;
  userId: string;
  analysisType: string;
  engine: string;
  config: Record<string, unknown>;
}): Promise<AnalysisRun> {
  const pool = getPool();
  try {
    const result = await pool.query<AnalysisRun>(QUERIES.CREATE, [
      data.projectId,
      data.datasetId,
      data.userId,
      data.analysisType,
      data.engine,
      JSON.stringify(data.config),
    ]);
    return result.rows[0]!;
  } finally {
    await pool.end();
  }
}

export async function completeAnalysis(
  analysisId: string,
  result: Record<string, unknown>
): Promise<AnalysisRun> {
  const pool = getPool();
  try {
    const completed = await pool.query<AnalysisRun>(QUERIES.COMPLETE, [
      analysisId,
      JSON.stringify(result),
    ]);
    return completed.rows[0]!;
  } finally {
    await pool.end();
  }
}

export async function failAnalysis(analysisId: string, errorMessage: string): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(QUERIES.FAIL, [analysisId, errorMessage]);
  } finally {
    await pool.end();
  }
}

export async function deleteAnalysis(analysisId: string): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(QUERIES.DELETE, [analysisId]);
    return (result.rowCount ?? 0) > 0;
  } finally {
    await pool.end();
  }
}
