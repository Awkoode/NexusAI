import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { getEnv } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { getProject } from '../repositories/projects';
import * as datasetRepo from '../repositories/datasets';
import { getStorage, resetStorage, setStorage } from '../storage';
import { LocalStorageProvider } from '../storage/local';
import { sanitizeFilename } from '../storage/supabase';
import {
  parseCsv,
  computeProfile,
  getPreview,
  LIMITS,
} from '../services/csvProcessor';
import {
  projectIdParamSchema,
  datasetIdParamSchema,
  uploadDatasetBodySchema,
  previewQuerySchema,
} from '../schemas/datasets';
import type {
  Dataset,
  DatasetPreview,
  DatasetProfile,
  DetectedColumnType,
} from '@nexusai/shared';

function respond(res: Response, data: unknown, status = 200): void {
  res.status(status).json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), version: 'v1' },
  });
}

function toZodDetails(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

/** Multer instance shared by the upload route (memory storage, strict limits). */
export function buildUploadMiddleware(): multer.Multer {
  const env = getEnv();
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 10 },
    fileFilter: (_req, file, cb) => {
      const name = file.originalname.toLowerCase();
      const mime = (file.mimetype || '').toLowerCase();
      const looksCsv =
        name.endsWith('.csv') ||
        mime.includes('csv') ||
        mime === 'text/plain' ||
        mime === 'application/octet-stream' ||
        mime === '';
      if (looksCsv) {
        cb(null, true);
      } else {
        cb(new AppError('FILE_TYPE_NOT_SUPPORTED', 'Only CSV files are supported', 400));
      }
    },
  });
}

async function requireOwnedProject(userId: string, projectId: string): Promise<void> {
  const project = await getProject(userId, projectId);
  if (!project) {
    throw AppError.notFound('PROJECT_NOT_FOUND', 'Project not found');
  }
}

async function requireOwnedDataset(userId: string, datasetId: string): Promise<Dataset> {
  const dataset = await datasetRepo.getDataset(datasetId);
  if (!dataset) {
    throw AppError.notFound('DATASET_NOT_FOUND', 'Dataset not found');
  }
  await requireOwnedProject(userId, dataset.projectId);
  return dataset;
}

function toPublicDataset(row: Dataset): Omit<Dataset, 'storagePath' | 'userId'> {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    fileSizeBytes: row.fileSizeBytes,
    rowCount: row.rowCount,
    columnCount: row.columnCount,
    status: row.status,
    errorMessage: row.errorMessage,
    schemaJson: row.schemaJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listProjectDatasets(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  try {
    const { projectId } = projectIdParamSchema.parse(req.params);
    await requireOwnedProject(req.user.id, projectId);
    const rows = await datasetRepo.listDatasets(projectId);
    respond(res, rows.map(toPublicDataset));
  } catch (error) {
    if (error instanceof ZodError) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Invalid project ID', {
        details: toZodDetails(error),
      });
    }
    throw error;
  }
}

export async function uploadDataset(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  const userId = req.user.id;

  const { projectId } = projectIdParamSchema.parse(req.params);
  await requireOwnedProject(userId, projectId);

  let name: string | undefined;
  try {
    name = uploadDatasetBodySchema.parse(req.body).name;
  } catch (error) {
    if (error instanceof ZodError) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Invalid dataset data', {
        details: toZodDetails(error),
      });
    }
    throw error;
  }

  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file?.buffer || file.buffer.length === 0) {
    throw AppError.badRequest('FILE_REQUIRED', 'A CSV file must be provided in the "file" field');
  }

  const displayFilename = sanitizeFilename(file.originalname ?? 'dataset.csv');
  const trimmedName = name?.trim();
  const datasetName = trimmedName ? trimmedName : displayFilename.replace(/\.csv$/i, '');
  const storagePath = LocalStorageProvider.generateKey(userId, projectId, displayFilename);
  const mimeType = file.mimetype ?? 'text/csv';

  // Register row first (status=uploaded) so failures are visible and retryable.
  const created = await datasetRepo.createDataset({
    projectId,
    userId,
    name: datasetName,
    originalFilename: displayFilename,
    storagePath,
    mimeType,
    fileSizeBytes: file.buffer.length,
  });

  const storage = getStorage();
  try {
    await storage.upload(storagePath, file.buffer, mimeType);
  } catch (error) {
    const message = 'Failed to store the uploaded file';
    logger.error(message, { datasetId: created.id }, error instanceof Error ? error : undefined);
    await datasetRepo.markDatasetFailed(created.id, message);
    throw AppError.internal('STORAGE_ERROR', message);
  }

  const parsed = parseCsv(file.buffer);
  if (!parsed.success || !parsed.data) {
    const message = parsed.error ?? 'Invalid CSV file';
    await datasetRepo.markDatasetFailed(created.id, message);
    throw AppError.badRequest('INVALID_CSV', message);
  }

  const schema = {
    columns: computeProfile(parsed.data).columns.map((c) => ({
      name: c.name,
      index: c.index,
      type: c.type,
      nonNullCount: c.nonNullCount,
      nullCount: c.nullCount,
      distinctCount: c.distinctCount,
    })),
  };

  const ready = await datasetRepo.markDatasetReady(
    created.id,
    parsed.data.rowCount,
    parsed.data.columnCount,
    schema
  );

  const full = await datasetRepo.getDataset(created.id);
  respond(
    res,
    toPublicDataset({
      ...(full ?? created),
      ...ready,
      name: datasetName,
      originalFilename: displayFilename,
    } as Dataset),
    201
  );
}

export async function getDatasetById(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  try {
    const { datasetId } = datasetIdParamSchema.parse(req.params);
    const dataset = await requireOwnedDataset(req.user.id, datasetId);
    respond(res, toPublicDataset(dataset));
  } catch (error) {
    if (error instanceof ZodError) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Invalid dataset ID', {
        details: toZodDetails(error),
      });
    }
    throw error;
  }
}

export async function getDatasetPreview(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  const { datasetId } = datasetIdParamSchema.parse(req.params);
  const { limit, offset } = previewQuerySchema.parse(req.query);
  const dataset = await requireOwnedDataset(req.user.id, datasetId);

  if (dataset.status !== 'ready') {
    throw AppError.badRequest('DATASET_NOT_READY', `Dataset is ${dataset.status ?? 'not ready'}`);
  }

  const storage = getStorage();
  let buffer: Buffer;
  try {
    if (!dataset.storagePath) throw new Error('Missing storage path');
    buffer = await storage.download(dataset.storagePath);
  } catch (error) {
    logger.error('Failed to read dataset file', { datasetId }, error instanceof Error ? error : undefined);
    throw AppError.internal('STORAGE_ERROR', 'Failed to read the dataset file');
  }

  const parsed = parseCsv(buffer);
  if (!parsed.success || !parsed.data) {
    throw AppError.internal('PARSE_ERROR', parsed.error ?? 'Failed to parse dataset file');
  }

  const preview = getPreview(parsed.data, limit, offset);
  const profile = computeProfile(parsed.data);
  const body: DatasetPreview = {
    datasetId,
    headers: preview.headers,
    columnTypes: profile.columns.map((c) => c.type as DetectedColumnType),
    rows: preview.rows,
    totalRows: preview.totalRows,
    previewRowCount: preview.previewRowCount,
    limit,
    offset,
  };
  respond(res, body);
}

export async function getDatasetProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  const { datasetId } = datasetIdParamSchema.parse(req.params);
  const dataset = await requireOwnedDataset(req.user.id, datasetId);

  if (dataset.status !== 'ready') {
    throw AppError.badRequest('DATASET_NOT_READY', `Dataset is ${dataset.status ?? 'not ready'}`);
  }

  const storage = getStorage();
  let buffer: Buffer;
  try {
    if (!dataset.storagePath) throw new Error('Missing storage path');
    buffer = await storage.download(dataset.storagePath);
  } catch (error) {
    logger.error('Failed to read dataset file', { datasetId }, error instanceof Error ? error : undefined);
    throw AppError.internal('STORAGE_ERROR', 'Failed to read the dataset file');
  }

  const parsed = parseCsv(buffer);
  if (!parsed.success || !parsed.data) {
    throw AppError.internal('PARSE_ERROR', parsed.error ?? 'Failed to parse dataset file');
  }

  const computed = computeProfile(parsed.data);
  const body: DatasetProfile = {
    datasetId,
    rowCount: computed.rowCount,
    columnCount: computed.columnCount,
    totalCells: computed.totalCells,
    missingCells: computed.missingCells,
    missingPercentage: computed.missingPercentage,
    numericColumnCount: computed.numericColumnCount,
    categoricalColumnCount: computed.categoricalColumnCount,
    fileSizeBytes: dataset.fileSizeBytes,
    columns: computed.columns.map((c) => ({
      name: c.name,
      index: c.index,
      type: c.type,
      nonNullCount: c.nonNullCount,
      nullCount: c.nullCount,
      distinctCount: c.distinctCount,
      ...(c.numericStats ? { numericStats: c.numericStats } : {}),
      ...(c.categoricalStats ? { categoricalStats: c.categoricalStats } : {}),
    })),
  };

  // Guard: JSON must never contain NaN/Infinity
  const serialized = JSON.parse(
    JSON.stringify(body, (_key, value: unknown) =>
      typeof value === 'number' && !Number.isFinite(value) ? null : value
    )
  ) as DatasetProfile;
  respond(res, serialized);
}

export async function deleteDatasetById(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  const { datasetId } = datasetIdParamSchema.parse(req.params);
  const dataset = await requireOwnedDataset(req.user.id, datasetId);

  // Delete the object first; if it fails, keep the row so nothing becomes orphaned silently.
  const storage = getStorage();
  try {
    if (dataset.storagePath) {
      await storage.delete(dataset.storagePath);
    }
  } catch (error) {
    logger.error('Failed to delete dataset file', { datasetId }, error instanceof Error ? error : undefined);
    throw AppError.internal('STORAGE_ERROR', 'Failed to delete the dataset file');
  }

  const deleted = await datasetRepo.deleteDataset(datasetId);
  if (!deleted) {
    throw AppError.notFound('DATASET_NOT_FOUND', 'Dataset not found');
  }
  res.status(204).send();
}

export { LIMITS };
export { resetStorage, setStorage };
