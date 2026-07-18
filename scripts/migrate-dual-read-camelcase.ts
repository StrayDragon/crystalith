// c65/dual-read: migration — snake_case → camelCase for all persisted JSON columns.
//
// Target columns:
//   - `messages.citations` (JSON array of Citation objects)
//   - `outputs.content` (JSON object that may contain nested keys)
//   - `research_steps.output_data` (JSON object — plan/search/analyze/summary data)
//   - `templates.config_json` (JSON object — template configuration)
//
// Run: `bun run scripts/migrate-dual-read-camelcase.ts`
// This script is idempotent (safe to re-run).
import { Database } from 'bun:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ── helpers ──────────────────────────────────────────────────────────────

/** Known snake→camel mappings for all persisted JSON keys. */
const SNAKE_TO_CAMEL: Record<string, string> = {
  // Citation-like
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
  // Output/render keys
  slide_id: 'slideId',
  output_id: 'outputId',
  key_points: 'keyPoints',
  is_default: 'isDefault',
  open_in_new_tab: 'openInNewTab',
  item_schema: 'itemSchema',
  // Template config
  session_titles: 'sessionTitles',
  source_tags: 'sourceTags',
  // Research outputData keys
  result_count: 'resultCount',
  new_results: 'newResults',
  need_more_search: 'needMore',
  report_length: 'reportLength',
  output_data: 'outputData',
  total_results: 'totalResults',
  has_report: 'hasReport',
  // Source re-embed response
  failed_count: 'failedCount',
  reembedded_count: 'reembeddedCount',
  // Diagnostic
  active_plugin_id: 'activePluginId',
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

// ── migrate helpers ──────────────────────────────────────────────────────

function migrateColumn(db: Database, table: string, column: string, label: string): number {
  const rows = db
    .query(`SELECT id, "${column}" FROM "${table}" WHERE "${column}" IS NOT NULL`)
    .all() as Array<{ id: number; [key: string]: unknown }>;

  let count = 0;
  for (const row of rows) {
    const val = row[column];
    if (!val) continue;
    const migrated = migrateKeys(val);
    if (val !== migrated && hasSnakeKeys(val)) {
      db.run(`UPDATE "${table}" SET "${column}" = ? WHERE id = ?`, [
        JSON.stringify(migrated),
        row.id,
      ]);
      count++;
    }
  }
  console.log(`[migrate-camelcase] Migrated ${count} ${label}`);
  return count;
}

// ── main ─────────────────────────────────────────────────────────────────

function main() {
  const dbPath =
    process.env.CL_DB_PATH ||
    (process.env.CL_DATA_ROOT
      ? `${process.env.CL_DATA_ROOT}/crystalith.db`
      : './data/crystalith.db');
  const resolvedPath = resolve(dbPath);

  if (!existsSync(resolvedPath)) {
    console.log(`[migrate-camelcase] DB not found at ${resolvedPath}; nothing to migrate.`);
    return;
  }

  const db = new Database(resolvedPath);
  console.log(`[migrate-camelcase] Opened DB: ${resolvedPath}`);

  migrateColumn(db, 'messages', 'citations', 'message citations');
  migrateColumn(db, 'outputs', 'content', 'output content records');
  migrateColumn(db, 'research_steps', 'output_data', 'research step output_data');
  migrateColumn(db, 'templates', 'config_json', 'template config_json');

  console.log('[migrate-camelcase] Done.');
  db.close();
}

main();
