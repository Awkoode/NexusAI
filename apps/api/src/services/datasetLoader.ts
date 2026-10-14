import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { getProject } from '../repositories/projects';
import { getDataset } from '../repositories/datasets';
import { getStorage } from '../storage';
import { parseCsv } from '../services/csvProcessor';

export interface LoadedDataset {
  id: string;
  projectId: string;
  headers: string[];
  rows: string[][];
}

/**
 * Shared dataset gate used by HTTP controllers AND the async worker.
 * Verifies project ownership, dataset membership/readiness, then parses
 * the stored file. Never trusts client-supplied paths or user IDs.
 */
export async function requireReadyDataset(
  userId: string,
  projectId: string,
  datasetId: string
): Promise<LoadedDataset> {
  const project = await getProject(userId, projectId);
  if (!project) {
    throw AppError.notFound('PROJECT_NOT_FOUND', 'Project not found');
  }
  const dataset = await getDataset(datasetId);
  if (!dataset || dataset.projectId !== projectId) {
    throw AppError.notFound('DATASET_NOT_FOUND', 'Dataset not found in this project');
  }
  if (dataset.status !== 'ready' || !dataset.storagePath) {
    throw AppError.badRequest('DATASET_NOT_READY', 'Dataset is not ready for analysis');
  }
  const storage = getStorage();
  let buffer: Buffer;
  try {
    buffer = await storage.download(dataset.storagePath);
  } catch (error) {
    logger.error('Failed to read dataset file', { datasetId }, error instanceof Error ? error : undefined);
    throw AppError.internal('STORAGE_ERROR', 'Failed to read the dataset file');
  }
  const parsed = parseCsv(buffer);
  if (!parsed.success || !parsed.data) {
    throw AppError.badRequest('INVALID_DATASET', parsed.error ?? 'Dataset file is invalid');
  }
  return { id: dataset.id, projectId, headers: parsed.data.headers, rows: parsed.data.rows };
}
