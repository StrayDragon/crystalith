import { Database } from 'bun:sqlite';
// Database initialization — single SQLite file + sqlite-vec extension.
//
// Opens `data/crystalith.db`, enables WAL mode + foreign keys, loads the
// sqlite-vec native extension, applies Drizzle migrations, and ensures the
// `vec_chunks` virtual table exists. The exported `orm` is the typed Drizzle
// instance used across the server.
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

// Migrations folder resolution order:
//   1. source tree, relative to this file (dev / tests — CWD-independent)
//   2. beside the executable (release archive layout: crystalith-server + web/dist + drizzle/)
//   3. CWD (manual deploys)
// In a compiled binary `import.meta.url` points into Bun's virtual FS, so the
// source-relative candidate misses and the release layout wins. Each candidate
// must contain `meta/_journal.json` to count.
function resolveMigrationsFolder(): string | null {
  const candidates = [
    import.meta.dirname ? join(import.meta.dirname, '..', '..', 'drizzle') : null,
    join(dirname(process.execPath), 'drizzle'),
    join(process.cwd(), 'drizzle'),
  ];
  for (const candidate of candidates) {
    if (candidate && existsSync(join(candidate, 'meta', '_journal.json'))) return candidate;
  }
  return null;
}

const MIGRATIONS_FOLDER = resolveMigrationsFolder();

/** sqlite-vec platform entry file name for the host platform. */
function sqliteVecEntryName(): string {
  if (process.platform === 'win32') return 'vec0.dll';
  if (process.platform === 'darwin') return 'vec0.dylib';
  return 'vec0.so';
}

/**
 * Locate the sqlite-vec native extension for compiled-binary fallback:
 * `CL_SQLITE_VEC_PATH` first, then `native/` beside the executable (release
 * archive layout). Returns null when neither exists.
 */
export function resolveSqliteVecNativePath(): string | null {
  const candidates = [
    process.env.CL_SQLITE_VEC_PATH,
    join(dirname(process.execPath), 'native', sqliteVecEntryName()),
  ];
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

/** Typed Drizzle ORM instance bound to the full schema map. */
export type Orm = BunSQLiteDatabase<typeof schema>;

let _orm: Orm | null = null;

/** Open the SQLite database + apply migrations + load extensions. */
export function createDb(path?: string): Orm {
  const dbPath = path ?? getDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath, { create: true });
  db.run('PRAGMA journal_mode = WAL;');
  db.run('PRAGMA foreign_keys = ON;');
  db.run('PRAGMA synchronous = NORMAL;');

  // sqlite-vec: load native extension into the bun:sqlite connection.
  // `sqliteVec.load` resolves the platform package via import.meta.resolve,
  // which cannot see node_modules inside a compiled single binary — on failure
  // fall back to `native/<vec0 ext>` beside the executable (release archive
  // layout; see scripts/build-release.ts) or CL_SQLITE_VEC_PATH.
  try {
    sqliteVec.load(db);
  } catch (error) {
    const nativePath = resolveSqliteVecNativePath();
    if (!nativePath) {
      throw new Error('[db] sqlite-vec native extension not found', { cause: error });
    }
    db.loadExtension(nativePath);
  }

  const orm = drizzle({ client: db, schema });

  // Apply pending Drizzle migrations (idempotent).
  if (MIGRATIONS_FOLDER === null) {
    console.warn('[db] migrations folder not found; migration skipped');
  } else {
    try {
      migrate(orm, { migrationsFolder: MIGRATIONS_FOLDER });
    } catch (error) {
      // Migrations may not exist yet on a fresh checkout before `drizzle-kit
      // generate`; the schema is still usable for in-memory tests. Surface the
      // warning but keep the ORM alive so dev servers can boot.
      console.warn('[db] migration skipped:', (error as Error).message);
    }
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
