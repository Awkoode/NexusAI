import { getEnv } from '../config/env';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

interface Migration {
  name: string;
  up: string;
  down: string;
}

// Read migrations from database/migrations directory
function loadMigrations(): Migration[] {
  const migrationsDir = path.join(process.cwd(), 'database', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    logger.warn('Migrations directory not found', { path: migrationsDir });
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return files.map((file) => {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const name = file.replace('.sql', '');

    // Split on -- UP and -- DOWN comments if present, otherwise treat as up only
    const upMatch = content.match(/--\s*UP\s*([\s\S]*?)(?=--\s*DOWN|$)/i);
    const downMatch = content.match(/--\s*DOWN\s*([\s\S]*?)$/i);

    return {
      name,
      up: upMatch ? upMatch[1]!.trim() : content.trim(),
      down: downMatch ? downMatch[1]!.trim() : '',
    };
  });
}

async function runMigrations(): Promise<void> {
  const env = getEnv();

  if (!env.DATABASE_URL) {
    logger.warn('DATABASE_URL not configured, skipping migrations');
    return;
  }

  const migrations: Migration[] = loadMigrations();

  if (migrations.length === 0) {
    logger.info('No migrations found');
    return;
  }

  logger.info('Running database migrations...', { count: migrations.length });

  const pool = new Pool({ connectionString: env.DATABASE_URL });

  try {
    // Create schema_migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Get applied migrations
    const { rows } = await pool.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY applied_at');
    const applied = new Set(rows.map((r) => r.name));

    for (const migration of migrations) {
      if (applied.has(migration.name)) {
        logger.debug(`Skipping already applied migration: ${migration.name}`);
        continue;
      }

      logger.info(`Applying migration: ${migration.name}`);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(migration.up);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
        await client.query('COMMIT');
        logger.info(`Migration applied: ${migration.name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    logger.info('Migrations completed successfully');
  } finally {
    await pool.end();
  }
}

async function rollbackMigration(name: string): Promise<void> {
  const env = getEnv();

  if (!env.DATABASE_URL) {
    logger.warn('DATABASE_URL not configured, skipping rollback');
    return;
  }

  const migrations = loadMigrations();
  const migration = migrations.find((m) => m.name === name);

  if (!migration) {
    throw new Error(`Migration ${name} not found`);
  }

  if (!migration.down) {
    throw new Error(`Migration ${name} has no down migration`);
  }

  logger.info(`Rolling back migration: ${name}`);

  const pool = new Pool({ connectionString: env.DATABASE_URL });

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration.down);
      await client.query('DELETE FROM schema_migrations WHERE name = $1', [name]);
      await client.query('COMMIT');
      logger.info(`Migration rolled back: ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

function createMigrationFile(name: string): void {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const filename = `${timestamp}_${name}.sql`;
  const filepath = path.join(process.cwd(), 'database', 'migrations', filename);

  const template = `-- Migration: ${name}
-- Created at: ${new Date().toISOString()}

-- UP
-- Add your migration SQL here

-- DOWN
-- Add rollback SQL here
`;

  fs.writeFileSync(filepath, template);
  logger.info(`Created migration file: ${filepath}`);
}

const command = process.argv[2];

switch (command) {
  case 'up':
    runMigrations().catch((err) => {
      logger.error('Migration failed', {}, err instanceof Error ? err : new Error(String(err)));
      process.exit(1);
    });
    break;
  case 'down':
    if (!process.argv[3]) {
      logger.error('Migration name required for rollback');
      process.exit(1);
    }
    rollbackMigration(process.argv[3]).catch((err) => {
      logger.error('Rollback failed', {}, err instanceof Error ? err : new Error(String(err)));
      process.exit(1);
    });
    break;
  case 'create':
    if (!process.argv[3]) {
      logger.error('Migration name required');
      process.exit(1);
    }
    try {
      createMigrationFile(process.argv[3]);
    } catch (err) {
      logger.error('Failed to create migration', {}, err instanceof Error ? err : new Error(String(err)));
      process.exit(1);
    }
    break;
  default:
    console.log(`
Usage:
  npm run db:migrate up          - Run all pending migrations
  npm run db:migrate down <name> - Rollback a specific migration
  npm run db:migrate create <name> - Create a new migration file
`);
    process.exit(1);
}