import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const projectIdParamSchema = z.object({
  projectId: z.string().regex(uuidRegex, 'Invalid project ID format'),
});

export const datasetIdParamSchema = z.object({
  datasetId: z.string().regex(uuidRegex, 'Invalid dataset ID format'),
});

export const uploadDatasetBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Dataset name is required')
    .max(200, 'Dataset name must be at most 200 characters')
    .optional(),
});

export const previewQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type UploadDatasetBody = z.infer<typeof uploadDatasetBodySchema>;
export type PreviewQuery = z.infer<typeof previewQuerySchema>;
