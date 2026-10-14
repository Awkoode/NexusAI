import { Pool } from 'pg';
import { getEnv } from '../config/env';
import type { Project } from '@nexusai/shared';

// SQL queries as constants for maintainability
const QUERIES = {
  LIST_PROJECTS: `
    SELECT id, name, description, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM projects
    WHERE user_id = $1
    ORDER BY created_at DESC
  `,
  GET_PROJECT: `
    SELECT id, name, description, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM projects
    WHERE id = $1 AND user_id = $2
  `,
  CREATE_PROJECT: `
    INSERT INTO projects (user_id, name, description)
    VALUES ($1, $2, $3)
    RETURNING id, name, description, created_at AS "createdAt", updated_at AS "updatedAt"
  `,
  UPDATE_PROJECT: `
    UPDATE projects
    SET name = COALESCE($3, name),
        description = COALESCE($4, description),
        updated_at = NOW()
    WHERE id = $1 AND user_id = $2
    RETURNING id, name, description, created_at AS "createdAt", updated_at AS "updatedAt"
  `,
  DELETE_PROJECT: `
    DELETE FROM projects
    WHERE id = $1 AND user_id = $2
  `,
} as const;

export function getPool(): Pool {
  const env = getEnv();
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  return new Pool({ connectionString: env.DATABASE_URL });
}

export async function listProjects(userId: string): Promise<Project[]> {
  const pool = getPool();
  try {
    const result = await pool.query<Project>(QUERIES.LIST_PROJECTS, [userId]);
    return result.rows;
  } finally {
    await pool.end();
  }
}

export async function getProject(userId: string, projectId: string): Promise<Project | null> {
  const pool = getPool();
  try {
    const result = await pool.query<Project>(QUERIES.GET_PROJECT, [projectId, userId]);
    return result.rows[0] ?? null;
  } finally {
    await pool.end();
  }
}

export async function createProject(
  userId: string,
  name: string,
  description?: string
): Promise<Project> {
  const pool = getPool();
  try {
    const result = await pool.query<Project>(QUERIES.CREATE_PROJECT, [
      userId,
      name,
      description ?? null,
    ]);
    return result.rows[0]!;
  } finally {
    await pool.end();
  }
}

export async function updateProject(
  userId: string,
  projectId: string,
  name?: string,
  description?: string | null
): Promise<Project | null> {
  const pool = getPool();
  try {
    const result = await pool.query<Project>(QUERIES.UPDATE_PROJECT, [
      projectId,
      userId,
      name ?? null,
      description !== undefined ? description : null,
    ]);
    return result.rows[0] ?? null;
  } finally {
    await pool.end();
  }
}

export async function deleteProject(userId: string, projectId: string): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(QUERIES.DELETE_PROJECT, [projectId, userId]);
    return (result.rowCount ?? 0) > 0;
  } finally {
    await pool.end();
  }
}