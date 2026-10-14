import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { getDataset } from '../repositories/datasets';
import * as experimentRepo from '../repositories/experiments';
import { getStorage } from '../storage';
import { parseCsv } from '../services/csvProcessor';
import { trainModel, MlServiceError } from '../services/mlClient';
import type { Experiment } from '@nexusai/shared';

export type ProgressCallback = (progress: number, stage: string) => Promise<void> | void;

function toSafeTrainingErrorMessage(detail: string): string {
  // Python already returns safe messages; cap length as defense in depth.
  return detail.slice(0, 500);
}

/**
 * Execute training and persist the run. Shared by the synchronous HTTP
 * endpoint and the async BullMQ worker — identical code path.
 * State machine: pending -> running -> completed|failed. A run row is created
 * before calling Python so crashes always leave a coherent, queryable state.
 */
export async function executeTraining(
  experiment: Experiment,
  onProgress?: ProgressCallback
): Promise<Experiment> {
  const dataset = await getDataset(experiment.datasetId);
  if (!dataset || dataset.projectId !== experiment.projectId) {
    await experimentRepo.markExperimentFailed(experiment.id, 'Dataset not found in this project');
    throw AppError.notFound('DATASET_NOT_FOUND', 'Dataset not found in this project');
  }
  if (dataset.status !== 'ready' || !dataset.storagePath) {
    await experimentRepo.markExperimentFailed(experiment.id, 'Dataset is not ready');
    throw AppError.badRequest('DATASET_NOT_READY', 'Dataset is not ready for training');
  }

  await experimentRepo.markExperimentRunning(experiment.id);
  const run = await experimentRepo.createRun(experiment.id);

  try {
    await onProgress?.(15, 'loading-dataset');
    const storage = getStorage();
    const buffer = await storage.download(dataset.storagePath);
    const parsed = parseCsv(buffer);
    if (!parsed.success || !parsed.data) {
      throw AppError.badRequest('INVALID_DATASET', parsed.error ?? 'Dataset file is invalid');
    }

    await onProgress?.(50, 'training');
    const result = await trainModel({
      task_type: experiment.taskType,
      model_type: experiment.modelType,
      target_column: experiment.targetColumn,
      feature_columns: experiment.featureColumns,
      columns: parsed.data.headers,
      rows: parsed.data.rows,
      test_size: experiment.config.testSize,
      random_state: experiment.config.randomState,
    });

    const metrics = result.metrics as {
      train_samples?: number;
      trainSamples?: number;
      test_samples?: number;
      testSamples?: number;
    };
    const trainSamples = Number(metrics.train_samples ?? metrics.trainSamples ?? 0);
    const testSamples = Number(metrics.test_samples ?? metrics.testSamples ?? 0);

    await onProgress?.(85, 'persisting');
    await experimentRepo.completeRun(run.id, {
      metrics: result.metrics,
      trainSamples,
      testSamples,
      modelParams: {
        model_type: result.model_type,
        test_size: result.test_size,
        random_state: result.random_state,
      },
      predictionsSummary: result.predictions_summary,
      trainSeconds: result.train_seconds,
      libraryVersions: result.library_versions,
    });
    await experimentRepo.markExperimentCompleted(experiment.id);
  } catch (error) {
    if (error instanceof MlServiceError) {
      const safe = toSafeTrainingErrorMessage(error.message);
      await experimentRepo.failRun(run.id, safe);
      await experimentRepo.markExperimentFailed(experiment.id, safe);
      if (error.statusCode === 422) {
        throw AppError.badRequest('TRAINING_ERROR', safe);
      }
      if (error.statusCode === 504) {
        throw AppError.serviceUnavailable('ML_TIMEOUT', safe);
      }
      throw AppError.serviceUnavailable('ML_UNAVAILABLE', safe);
    }
    if (error instanceof AppError) {
      await experimentRepo.failRun(run.id, error.message);
      await experimentRepo.markExperimentFailed(experiment.id, error.message);
      throw error;
    }
    logger.error('Unexpected training failure', { experimentId: experiment.id });
    await experimentRepo.failRun(run.id, 'Training failed');
    await experimentRepo.markExperimentFailed(experiment.id, 'Training failed');
    throw AppError.internal('TRAINING_FAILED', 'Training failed');
  }

  const updated = await experimentRepo.getExperiment(experiment.id);
  if (!updated) throw AppError.notFound('EXPERIMENT_NOT_FOUND', 'Experiment not found');
  return updated;
}
