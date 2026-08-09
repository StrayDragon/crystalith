import { Database } from 'bun:sqlite';
// Database initialization — single SQLite file + sqlite-vec extension.
//
// Opens `data/crystalith.db`, enables WAL mode + foreign keys, loads the
// sqlite-vec native extension, applies Drizzle migrations, and ensures the
// `vec_chunks` virtual table exists. The exported `orm` is the typed Drizzle
// instance used across the server.
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sql } from 'drizzle-orm';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as sqliteVec from 'sqlite-vec';

import { getDataRoot } from '../shared/config.ts';
import * as schema from './schema';
import { initVecChunks } from './vectors';

// DB file lives under the data root directory.
// Default (<data_root>/crystalith.db) assumes CWD = repo root (justfile
// ensures this).  Override via CL_DB_PATH env for tests / custom deployments,
// or set storage.data_root / CL_DATA_ROOT for a project-wide data root.
export function getDbPath(): string {
  return process.env.CL_DB_PATH ?? join(getDataRoot(), 'crystalith.db');
}

// Migrations folder is resolved relative to this source file so tests and
// production both find it regardless of CWD.
const __dirname = import.meta.dirname;
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Typed Drizzle ORM instance bound to the full schema map. */
export type Orm = BunSQLiteDatabase<typeof schema>;

let _orm: Orm | null = null;

/** Open the SQLite database + apply migrations + load extensions. */
export function createDb(path?: string): Orm {
  const dbPath = path ?? getDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath, { create: true });
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA synchronous = NORMAL;');

  // sqlite-vec: load native extension into the bun:sqlite connection.
  sqliteVec.load(db as unknown as Parameters<typeof sqliteVec.load>[0]);

  const orm = drizzle({ client: db, schema });

  // Apply pending Drizzle migrations (idempotent).
  // Path is CWD-independent — resolved relative to this source file.
  try {
    migrate(orm, { migrationsFolder: MIGRATIONS_FOLDER });
  } catch (error) {
    // Migrations may not exist yet on a fresh checkout before `drizzle-kit
    // generate`; the schema is still usable for in-memory tests. Surface the
    // warning but keep the ORM alive so dev servers can boot.
    console.warn('[db] migration skipped:', (error as Error).message);
  }

  // Provision the sqlite-vec virtual table (not managed by Drizzle).
  initVecChunks(orm);

  return orm;
}

/** Process-wide singleton (the desktop app talks to one DB file). */
export function db(): Orm {
  _orm ??= createDb();
  return _orm;
}

/** Reset the singleton — tests use a fresh temp DB per run. */
export function resetDb(orm: Orm | null = null): void {
  _orm = orm;
}

// Re-export schema + SQL helper for convenience.
export { schema, sql };
export * from './schema';
