import { getPool } from './projects';
import type { Experiment, ModelRun } from '@nexusai/shared';

const QUERIES = {
  LIST_BY_PROJECT: `
    SELECT e.id, e.project_id AS "projectId", e.dataset_id AS "datasetId",
           e.user_id AS "userId", e.name, e.task_type AS "taskType",
           e.model_type AS "modelType", e.target_column AS "targetColumn",
           e.feature_columns AS "featureColumns", e.config_json AS "config",
           e.status, e.error_message AS "errorMessage",
           e.created_at AS "createdAt", e.updated_at AS "updatedAt",
           e.started_at AS "startedAt", e.completed_at AS "completedAt"
    FROM experiments e
    WHERE e.project_id = $1
    ORDER BY e.created_at DESC
  `,
  GET_BY_ID: `
    SELECT e.id, e.project_id AS "projectId", e.dataset_id AS "datasetId",
           e.user_id AS "userId", e.name, e.task_type AS "taskType",
           e.model_type AS "modelType", e.target_column AS "targetColumn",
           e.feature_columns AS "featureColumns", e.config_json AS "config",
           e.status, e.error_message AS "errorMessage",
           e.created_at AS "createdAt", e.updated_at AS "updatedAt",
           e.started_at AS "startedAt", e.completed_at AS "completedAt"
    FROM experiments e
    WHERE e.id = $1
  `,
  CREATE: `
    INSERT INTO experiments
      (project_id, dataset_id, user_id, name, task_type, model_type,
       target_column, feature_columns, config_json, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
    RETURNING id, project_id AS "projectId", dataset_id AS "datasetId",
              name, task_type AS "taskType", model_type AS "modelType",
              target_column AS "targetColumn", feature_columns AS "featureColumns",
              config_json AS "config", status,
              created_at AS "createdAt", updated_at AS "updatedAt"
  `,
  MARK_RUNNING: `
    UPDATE experiments
    SET status = 'running', started_at = NOW(), error_message = NULL
    WHERE id = $1
    RETURNING id, status, started_at AS "startedAt"
  `,
  MARK_COMPLETED: `
    UPDATE experiments
    SET status = 'completed', completed_at = NOW(), error_message = NULL
    WHERE id = $1
    RETURNING id, status, completed_at AS "completedAt"
  `,
  MARK_FAILED: `
    UPDATE experiments
    SET status = 'failed', completed_at = NOW(), error_message = $2
    WHERE id = $1
    RETURNING id, status, error_message AS "errorMessage", completed_at AS "completedAt"
  `,
  DELETE: `DELETE FROM experiments WHERE id = $1`,
  CREATE_RUN: `
    INSERT INTO model_runs (experiment_id, status)
    VALUES ($1, 'running')
    RETURNING id, experiment_id AS "experimentId", status,
              created_at AS "createdAt"
  `,
  COMPLETE_RUN: `
    UPDATE model_runs
    SET status = 'completed', metrics_json = $2, train_samples = $3, test_samples = $4,
        model_params_json = $5, predictions_summary_json = $6, train_seconds = $7,
        library_versions_json = $8, completed_at = NOW()
    WHERE id = $1
    RETURNING id, experiment_id AS "experimentId", status,
              metrics_json AS "metrics", train_samples AS "trainSamples",
              test_samples AS "testSamples", model_params_json AS "modelParams",
              predictions_summary_json AS "predictionsSummary",
              train_seconds AS "trainSeconds",
              library_versions_json AS "libraryVersions",
              created_at AS "createdAt", completed_at AS "completedAt"
  `,
  FAIL_RUN: `
    UPDATE model_runs
    SET status = 'failed', error_message = $2, completed_at = NOW()
    WHERE id = $1
    RETURNING id, status
  `,
  LATEST_RUN: `
    SELECT id, experiment_id AS "experimentId", status,
           metrics_json AS "metrics", train_samples AS "trainSamples",
           test_samples AS "testSamples", model_params_json AS "modelParams",
           predictions_summary_json AS "predictionsSummary",
           train_seconds AS "trainSeconds",
           library_versions_json AS "libraryVersions",
           error_message AS "errorMessage",
           created_at AS "createdAt", completed_at AS "completedAt"
    FROM model_runs
    WHERE experiment_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `,
  LIST_RUNS: `
    SELECT id, experiment_id AS "experimentId", status,
           metrics_json AS "metrics", train_samples AS "trainSamples",
           test_samples AS "testSamples", model_params_json AS "modelParams",
           predictions_summary_json AS "predictionsSummary",
           train_seconds AS "trainSeconds",
           library_versions_json AS "libraryVersions",
           error_message AS "errorMessage",
           created_at AS "createdAt", completed_at AS "completedAt"
    FROM model_runs
    WHERE experiment_id = $1
    ORDER BY created_at DESC
  `,
} as const;

export async function listExperimentsByProject(projectId: string): Promise<Experiment[]> {
  const pool = getPool();
  try {
    const result = await pool.query<Experiment>(QUERIES.LIST_BY_PROJECT, [projectId]);
    return result.rows;
  } finally {
    await pool.end();
  }
}

export async function getExperiment(experimentId: string): Promise<Experiment | null> {
  const pool = getPool();
  try {
    const result = await pool.query<Experiment>(QUERIES.GET_BY_ID, [experimentId]);
    return result.rows[0] ?? null;
  } finally {
    await pool.end();
  }
}

export async function createExperiment(data: {
  projectId: string;
  datasetId: string;
  userId: string;
  name: string;
  taskType: string;
  modelType: string;
  targetColumn: string;
  featureColumns: string[];
  config: { testSize: number; randomState: number };
}): Promise<Experiment> {
  const pool = getPool();
  try {
    const result = await pool.query<Experiment>(QUERIES.CREATE, [
      data.projectId,
      data.datasetId,
      data.userId,
      data.name,
      data.taskType,
      data.modelType,
      data.targetColumn,
      JSON.stringify(data.featureColumns),
      JSON.stringify(data.config),
    ]);
    return result.rows[0]!;
  } finally {
    await pool.end();
  }
}

export async function markExperimentRunning(experimentId: string): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(QUERIES.MARK_RUNNING, [experimentId]);
  } finally {
    await pool.end();
  }
}

export async function markExperimentCompleted(experimentId: string): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(QUERIES.MARK_COMPLETED, [experimentId]);
  } finally {
    await pool.end();
  }
}

export async function markExperimentFailed(experimentId: string, errorMessage: string): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(QUERIES.MARK_FAILED, [experimentId, errorMessage]);
  } finally {
    await pool.end();
  }
}

export async function deleteExperiment(experimentId: string): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(QUERIES.DELETE, [experimentId]);
    return (result.rowCount ?? 0) > 0;
  } finally {
    await pool.end();
  }
}

export async function createRun(experimentId: string): Promise<ModelRun> {
  const pool = getPool();
  try {
    const result = await pool.query<ModelRun>(QUERIES.CREATE_RUN, [experimentId]);
    return result.rows[0]!;
  } finally {
    await pool.end();
  }
}

export async function completeRun(
  runId: string,
  data: {
    metrics: Record<string, unknown>;
    trainSamples: number;
    testSamples: number;
    modelParams: Record<string, unknown>;
    predictionsSummary: Record<string, unknown>;
    trainSeconds: number;
    libraryVersions: Record<string, string>;
  }
): Promise<ModelRun> {
  const pool = getPool();
  try {
    const result = await pool.query<ModelRun>(QUERIES.COMPLETE_RUN, [
      runId,
      JSON.stringify(data.metrics),
      data.trainSamples,
      data.testSamples,
      JSON.stringify(data.modelParams),
      JSON.stringify(data.predictionsSummary),
      data.trainSeconds,
      JSON.stringify(data.libraryVersions),
    ]);
    return result.rows[0]!;
  } finally {
    await pool.end();
  }
}

export async function failRun(runId: string, errorMessage: string): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(QUERIES.FAIL_RUN, [runId, errorMessage]);
  } finally {
    await pool.end();
  }
}

export async function getLatestRun(experimentId: string): Promise<ModelRun | null> {
  const pool = getPool();
  try {
    const result = await pool.query<ModelRun>(QUERIES.LATEST_RUN, [experimentId]);
    return result.rows[0] ?? null;
  } finally {
    await pool.end();
  }
}

export async function listRuns(experimentId: string): Promise<ModelRun[]> {
  const pool = getPool();
  try {
    const result = await pool.query<ModelRun>(QUERIES.LIST_RUNS, [experimentId]);
    return result.rows;
  } finally {
    await pool.end();
  }
}
