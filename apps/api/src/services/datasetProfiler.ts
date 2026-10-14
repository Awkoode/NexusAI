import { requireReadyDataset } from '../services/datasetLoader';
import { computeProfile } from '../services/csvProcessor';

export type ProgressCallback = (progress: number, stage: string) => Promise<void> | void;

/**
 * Recompute a dataset's descriptive profile from the stored file.
 * Shared by the profile endpoint logic and the async `dataset.profile` job.
 * `requireReadyDataset` already loads + parses the authoritative file.
 */
export async function profileDataset(
  userId: string,
  projectId: string,
  datasetId: string,
  onProgress?: ProgressCallback
): Promise<Record<string, unknown>> {
  await onProgress?.(15, 'loading-dataset');
  const dataset = await requireReadyDataset(userId, projectId, datasetId);
  await onProgress?.(50, 'profiling');
  const profile = computeProfile({ headers: dataset.headers, rows: dataset.rows, columnCount: dataset.headers.length, rowCount: dataset.rows.length });
  await onProgress?.(90, 'done');
  return JSON.parse(JSON.stringify(profile)) as Record<string, unknown>;
}
