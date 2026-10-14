import { getPool } from './projects';
import type { Dataset } from '@nexusai/shared';

const QUERIES = {
  LIST_DATASETS: `
    SELECT id, project_id AS "projectId", name, original_filename AS "originalFilename",
           mime_type AS "mimeType", file_size_bytes AS "fileSizeBytes",
           row_count AS "rowCount", column_count AS "columnCount",
           status, error_message AS "errorMessage", schema_json AS "schemaJson",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM datasets
    WHERE project_id = $1
    ORDER BY created_at DESC
  `,
  GET_DATASET: `
    SELECT id, project_id AS "projectId", user_id AS "userId", name,
           original_filename AS "originalFilename", storage_path AS "storagePath",
           mime_type AS "mimeType", file_size_bytes AS "fileSizeBytes",
           row_count AS "rowCount", column_count AS "columnCount",
           status, error_message AS "errorMessage", schema_json AS "schemaJson",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM datasets
    WHERE id = $1
  `,
  CREATE_DATASET: `
    INSERT INTO datasets (project_id, user_id, name, original_filename, storage_path, mime_type, file_size_bytes, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'uploaded')
    RETURNING id, project_id AS "projectId", name, original_filename AS "originalFilename",
              mime_type AS "mimeType", file_size_bytes AS "fileSizeBytes",
              status, created_at AS "createdAt", updated_at AS "updatedAt"
  `,
  UPDATE_DATASET_READY: `
    UPDATE datasets
    SET status = 'ready', row_count = $2, column_count = $3, schema_json = $4
    WHERE id = $1
    RETURNING id, status, row_count AS "rowCount", column_count AS "columnCount", schema_json AS "schemaJson"
  `,
  UPDATE_DATASET_FAILED: `
    UPDATE datasets
    SET status = 'failed', error_message = $2
    WHERE id = $1
    RETURNING id, status, error_message AS "errorMessage"
  `,
  DELETE_DATASET: `
    DELETE FROM datasets
    WHERE id = $1
  `,
  GET_DATASET_STORAGE_PATH: `
    SELECT storage_path AS "storagePath"
    FROM datasets
    WHERE id = $1
  `,
} as const;

export async function listDatasets(projectId: string): Promise<Dataset[]> {
  const pool = getPool();
  try {
    const result = await pool.query<Dataset>(QUERIES.LIST_DATASETS, [projectId]);
    return result.rows;
  } finally {
    await pool.end();
  }
}

export async function getDataset(datasetId: string): Promise<Dataset | null> {
  const pool = getPool();
  try {
    const result = await pool.query<Dataset>(QUERIES.GET_DATASET, [datasetId]);
    return result.rows[0] ?? null;
  } finally {
    await pool.end();
  }
}

export async function createDataset(data: {
  projectId: string;
  userId: string;
  name: string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
}): Promise<Dataset> {
  const pool = getPool();
  try {
    const result = await pool.query<Dataset>(QUERIES.CREATE_DATASET, [
      data.projectId,
      data.userId,
      data.name,
      data.originalFilename,
      data.storagePath,
      data.mimeType,
      data.fileSizeBytes,
    ]);
    return result.rows[0]!;
  } finally {
    await pool.end();
  }
}

export async function markDatasetReady(
  datasetId: string,
  rowCount: number,
  columnCount: number,
  schemaJson: object
): Promise<Dataset> {
  const pool = getPool();
  try {
    const result = await pool.query<Dataset>(QUERIES.UPDATE_DATASET_READY, [
      datasetId,
      rowCount,
      columnCount,
      JSON.stringify(schemaJson),
    ]);
    return result.rows[0]!;
  } finally {
    await pool.end();
  }
}

export async function markDatasetFailed(datasetId: string, errorMessage: string): Promise<Dataset> {
  const pool = getPool();
  try {
    const result = await pool.query<Dataset>(QUERIES.UPDATE_DATASET_FAILED, [datasetId, errorMessage]);
    return result.rows[0]!;
  } finally {
    await pool.end();
  }
}

export async function deleteDataset(datasetId: string): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(QUERIES.DELETE_DATASET, [datasetId]);
    return (result.rowCount ?? 0) > 0;
  } finally {
    await pool.end();
  }
}

export async function getDatasetStoragePath(datasetId: string): Promise<string | null> {
  const pool = getPool();
  try {
    const result = await pool.query<{ storagePath: string }>(QUERIES.GET_DATASET_STORAGE_PATH, [datasetId]);
    return result.rows[0]?.storagePath ?? null;
  } finally {
    await pool.end();
  }
}
