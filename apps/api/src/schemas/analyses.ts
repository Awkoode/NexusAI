import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ANALYSIS_TYPES = [
  'describe',
  'correlation',
  'covariance',
  'linear_algebra',
  'compare',
] as const;

export const projectIdParamSchema = z.object({
  projectId: z.string().regex(uuidRegex, 'Invalid project ID format'),
});

export const analysisIdParamSchema = z.object({
  analysisId: z.string().regex(uuidRegex, 'Invalid analysis ID format'),
});

const columnName = z.string().trim().min(1).max(200);

export const runAnalysisSchema = z
  .object({
    datasetId: z.string().regex(uuidRegex, 'Invalid dataset ID format'),
    analysisType: z.enum(ANALYSIS_TYPES),
    columns: z.array(columnName).min(1).max(50).optional(),
    missingPolicy: z.enum(['pairwise', 'listwise']).default('pairwise'),
    maxRows: z.number().int().min(10).max(20000).default(5000),
  })
  .refine(
    (d) => d.analysisType !== 'linear_algebra' || (d.columns?.length ?? 0) >= 1,
    { message: 'linear_algebra requires at least one column', path: ['columns'] }
  );

export type RunAnalysisInput = z.infer<typeof runAnalysisSchema>;
