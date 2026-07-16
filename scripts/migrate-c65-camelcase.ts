// c65: migration — embedded JSON snake_case → camelCase for citation-like fields.
//
// Target columns:
//   - `messages.citations` (JSON array of Citation objects)
//   - `outputs.content` (JSON object that may contain nested citation-like keys)
//
// This script is idempotent (safe to re-run). It only transforms known snake_case
// keys to camelCase and leaves already-camelCase entries unchanged.
// Run: `bun run scripts/migrate-c65-camelcase.ts`
//
// NOTE: Citation objects created after c64 already use camelCase (sourceId,
// chunkId, chunkIndex, pageNumber, paragraphIndex). This migration handles
// any lingering v1 snake_case citations stored before c64 was applied.
import { Database } from 'bun:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ── helpers ──────────────────────────────────────────────────────────────

/** Known snake→camel mappings for citation-like objects. */
const SNAKE_TO_CAMEL: Record<string, string> = {
  source_id: 'sourceId',
  source_name: 'sourceName',
  chunk_id: 'chunkId',
  chunk_index: 'chunkIndex',
  page_number: 'pageNumber',
  paragraph_index: 'paragraphIndex',
  start_offset: 'startOffset',
  end_offset: 'endOffset',
  dedup_key: 'dedupKey',
  mime_type: 'mimeType',
  parser_type: 'parserType',
  error_code: 'errorCode',
  error_message: 'errorMessage',
  recovery_hint: 'recoveryHint',
  last_error_at: 'lastErrorAt',
  chunk_count: 'chunkCount',
  token_count: 'tokenCount',
  notebook_id: 'notebookId',
  session_id: 'sessionId',
  source_ids: 'sourceIds',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  display_name: 'displayName',
  is_tool: 'isTool',
  is_builtin: 'isBuiltin',
  config_json: 'configJson',
  config_schema: 'configSchema',
  system_prompt: 'systemPrompt',
  shared_state: 'sharedState',
  shared_state_revision: 'sharedStateRevision',
  frontend_bundle: 'frontendBundle',
  render_descriptor: 'renderDescriptor',
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Recursively convert known snake_case keys to camelCase. */
function migrateKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(migrateKeys);
  }
  if (!isRecord(obj)) return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = SNAKE_TO_CAMEL[key] ?? key;
    result[camelKey] = migrateKeys(value);
  }
  return result;
}

/** Check if any key in an object (or nested) matches a snake_case pattern. */
function hasSnakeKeys(obj: unknown): boolean {
  if (Array.isArray(obj)) {
    return obj.some(hasSnakeKeys);
  }
  if (!isRecord(obj)) return false;
  for (const key of Object.keys(obj)) {
    if (key.includes('_')) return true;
    if (hasSnakeKeys(obj[key])) return true;
  }
  return false;
}

// ── main ─────────────────────────────────────────────────────────────────

function main() {
  // Resolve DB path (same logic as app config)
  const dbPath =
    process.env.CL_DB_PATH ||
    (process.env.CL_DATA_ROOT
      ? `${process.env.CL_DATA_ROOT}/crystalith.db`
      : './data/crystalith.db');
  const resolvedPath = resolve(dbPath);

  if (!existsSync(resolvedPath)) {
    console.log(`[c65-migrate] DB not found at ${resolvedPath}; nothing to migrate.`);
    return;
  }

  const db = new Database(resolvedPath);
  console.log(`[c65-migrate] Opened DB: ${resolvedPath}`);

  // ── messages.citations ──
  const msgRows = db
    .query(`SELECT id, citations FROM messages WHERE citations IS NOT NULL`)
    .all() as Array<{ id: number; citations: unknown }>;

  let migratedMsgs = 0;
  for (const row of msgRows) {
    if (!row.citations) continue;
    const migrated = migrateKeys(row.citations);
    if (row.citations !== migrated && hasSnakeKeys(row.citations)) {
      db.run(`UPDATE messages SET citations = ? WHERE id = ?`, [JSON.stringify(migrated), row.id]);
      migratedMsgs++;
    }
  }
  console.log(`[c65-migrate] Migrated ${migratedMsgs} message citations`);

  // ── outputs.content ──
  const outRows = db
    .query(`SELECT id, content FROM outputs WHERE content IS NOT NULL`)
    .all() as Array<{ id: number; content: unknown }>;

  let migratedOutputs = 0;
  for (const row of outRows) {
    if (!row.content) continue;
    const migrated = migrateKeys(row.content);
    if (row.content !== migrated && hasSnakeKeys(row.content)) {
      db.run(`UPDATE outputs SET content = ? WHERE id = ?`, [JSON.stringify(migrated), row.id]);
      migratedOutputs++;
    }
  }
  console.log(`[c65-migrate] Migrated ${migratedOutputs} output content records`);

  console.log('[c65-migrate] Done.');
  db.close();
}

main();
