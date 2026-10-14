import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const JOB_TYPES = [
  'dataset.profile',
  'ml.train',
  'analysis.describe',
  'analysis.correlation',
  'analysis.covariance',
  'analysis.linear-algebra',
  'analysis.compare',
] as const;

export type JobTypeName = (typeof JOB_TYPES)[number];

/**
 * Payload to create a job. Only identifiers + validated params — never file
 * contents, tokens, or secrets.
 */
export const createJobSchema = z.discriminatedUnion('jobType', [
  z.object({
    jobType: z.literal('dataset.profile'),
    projectId: z.string().regex(uuidRegex),
    datasetId: z.string().regex(uuidRegex),
  }),
  z.object({
    jobType: z.literal('ml.train'),
    projectId: z.string().regex(uuidRegex),
    datasetId: z.string().regex(uuidRegex),
    experimentId: z.string().regex(uuidRegex).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    taskType: z.enum(['regression', 'classification']),
    modelType: z.string().min(1).max(64),
    targetColumn: z.string().trim().min(1).max(200),
    featureColumns: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
    testSize: z.number().min(0.1).max(0.5).default(0.2),
    randomState: z.number().int().min(0).default(42),
  }),
  z.object({
    jobType: z.enum([
      'analysis.describe',
      'analysis.correlation',
      'analysis.covariance',
      'analysis.linear-algebra',
      'analysis.compare',
    ]),
    projectId: z.string().regex(uuidRegex),
    datasetId: z.string().regex(uuidRegex),
    columns: z.array(z.string().trim().min(1).max(200)).min(1).max(50).optional(),
    missingPolicy: z.enum(['pairwise', 'listwise']).default('pairwise'),
    maxRows: z.number().int().min(10).max(20000).default(5000),
  }),
]);

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const jobIdParamSchema = z.object({
  jobId: z.string().regex(uuidRegex, 'Invalid job ID format'),
});

export const listJobsQuerySchema = z.object({
  status: z
    .enum(['queued', 'active', 'completed', 'failed', 'cancelled', 'cancel_requested'])
    .optional(),
  jobType: z.enum(JOB_TYPES).optional(),
  projectId: z.string().regex(uuidRegex, 'Invalid project ID format').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
