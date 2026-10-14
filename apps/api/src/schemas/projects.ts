import { z } from 'zod';

// UUID validation regex
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Schema for creating a new project
 */
export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(200, 'Project name must be at most 200 characters'),
  description: z.string().trim().max(5000, 'Description must be at most 5000 characters').optional(),
});

/**
 * Schema for updating an existing project
 */
export const updateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(200, 'Project name must be at most 200 characters').optional(),
  description: z.string().trim().max(5000, 'Description must be at most 5000 characters').nullable().optional(),
}).refine(
  (data) => data.name !== undefined || data.description !== undefined,
  { message: 'At least one field must be provided for update' }
);

/**
 * Schema for project ID parameter
 */
export const projectIdSchema = z.object({
  id: z.string().regex(uuidRegex, 'Invalid project ID format'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectIdParams = z.infer<typeof projectIdSchema>;