import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REGRESSION_MODELS = ['linear_regression', 'random_forest_regressor'] as const;
const CLASSIFICATION_MODELS = ['logistic_regression', 'random_forest_classifier'] as const;

export const createExperimentSchema = z
  .object({
    name: z.string().trim().min(1, 'Experiment name is required').max(200).optional(),
    projectId: z.string().regex(uuidRegex, 'Invalid project ID format'),
    datasetId: z.string().regex(uuidRegex, 'Invalid dataset ID format'),
    taskType: z.enum(['regression', 'classification']),
    modelType: z.string().min(1).max(64),
    targetColumn: z.string().trim().min(1).max(200),
    featureColumns: z
      .array(z.string().trim().min(1).max(200))
      .min(1, 'Select at least one feature column')
      .max(100),
    testSize: z.number().min(0.1).max(0.5).default(0.2),
    randomState: z.number().int().min(0).default(42),
  })
  .refine((d) => !d.featureColumns.includes(d.targetColumn), {
    message: 'targetColumn must not be listed in featureColumns',
    path: ['featureColumns'],
  })
  .refine(
    (d) =>
      d.taskType === 'regression'
        ? (REGRESSION_MODELS as readonly string[]).includes(d.modelType)
        : (CLASSIFICATION_MODELS as readonly string[]).includes(d.modelType),
    { message: 'modelType is not allowed for this task', path: ['modelType'] }
  );

export const experimentIdParamSchema = z.object({
  id: z.string().regex(uuidRegex, 'Invalid experiment ID format'),
});

export type CreateExperimentInput = z.infer<typeof createExperimentSchema>;
export const ALLOWED_REGRESSION_MODELS = [...REGRESSION_MODELS];
export const ALLOWED_CLASSIFICATION_MODELS = [...CLASSIFICATION_MODELS];
