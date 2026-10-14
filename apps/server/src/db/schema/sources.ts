// Sources domain — sources, chunks, tags, tag map, connector bindings.
import type { ImportScope, JsonMetadata, Snapshot, SyncCheckResult } from '@crystalith/shared';
import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { json, jsonReq, ts, tsNull, tsUpd } from './columns.ts';
import { notebooks } from './notebooks.ts';

export const sources = sqliteTable(
  'sources',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    mimeType: text('mime_type'),
    parserType: text('parser_type').notNull().default('text'),
    metadata: json<JsonMetadata | null>('metadata'),
    dedupKey: text('dedup_key'),
    status: text('status', { enum: ['processing', 'ready', 'failed'] })
      .notNull()
      .default('processing'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    recoveryHint: text('recovery_hint'),
    lastErrorAt: tsNull('last_error_at'),
    // c132 r485: non-null marks a HIDDEN derived container row auto-created to
    // index an output (value = that output's id). Excluded from every
    // user-visible sources surface; deleting the output cascades to this row.
    derivedOutputId: integer('derived_output_id'),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [
    index('ix_sources_notebook_id_status').on(t.notebookId, t.status),
    index('ix_sources_notebook_id_dedup_key').on(t.notebookId, t.dedupKey),
  ],
);

export const sourceRelations = relations(sources, ({ one, many }) => ({
  notebook: one(notebooks, { fields: [sources.notebookId], references: [notebooks.id] }),
  chunks: many(chunks),
  tagLinks: many(sourceTagMap),
}));

export const chunks = sqliteTable(
  'chunks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceId: integer('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    text: text('text').notNull(),
    startOffset: integer('start_offset'),
    endOffset: integer('end_offset'),
    metadata: json<JsonMetadata | null>('metadata'),
    // Embedding index metadata (c130 r479): modality defaults to text until
    // multimodal ingest lands; model/dims are stamped by indexSource (re-embed
    // updates them). origin_* are write-only groundwork for c132 (origin
    // generalization) — legacy rows are backfilled origin_id = source_id.
    modality: text('modality').notNull().default('text'),
    embeddingModel: text('embedding_model'),
    embeddingDims: integer('embedding_dims'),
    originType: text('origin_type').notNull().default('source'),
    originId: integer('origin_id'),
    // Keyword-channel token space (c132 r487): space-joined CJK-bigram / word
    // tokens computed application-side at write time (db/chunks.ts seam);
    // chunks_fts indexes this column — unicode61 cannot segment CJK raw text.
    // Nullable only during boot backfill; every write path populates it.
    textTokens: text('text_tokens'),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [
    uniqueIndex('uq_chunks_source_id_chunk_index').on(t.sourceId, t.chunkIndex),
    index('ix_chunks_source_id_chunk_index').on(t.sourceId, t.chunkIndex),
  ],
);

export const chunkRelations = relations(chunks, ({ one }) => ({
  source: one(sources, { fields: [chunks.sourceId], references: [sources.id] }),
}));

export const sourceTags = sqliteTable(
  'source_tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [
    uniqueIndex('uq_source_tags_notebook_id_name').on(t.notebookId, t.name),
    index('ix_source_tags_notebook_id_name').on(t.notebookId, t.name),
  ],
);

export const sourceTagRelations = relations(sourceTags, ({ one, many }) => ({
  notebook: one(notebooks, { fields: [sourceTags.notebookId], references: [notebooks.id] }),
  sourceLinks: many(sourceTagMap),
}));

export const sourceTagMap = sqliteTable(
  'source_tag_map',
  {
    sourceId: integer('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => sourceTags.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at'),
  },
  (t) => [
    primaryKey({ columns: [t.sourceId, t.tagId] }),
    index('ix_source_tag_map_tag_id').on(t.tagId),
  ],
);

export const sourceTagMapRelations = relations(sourceTagMap, ({ one }) => ({
  source: one(sources, { fields: [sourceTagMap.sourceId], references: [sources.id] }),
  tag: one(sourceTags, { fields: [sourceTagMap.tagId], references: [sourceTags.id] }),
}));

// ---------------------------------------------------------------------------
// Source connector bindings
// ---------------------------------------------------------------------------

export const sourceConnectorBindings = sqliteTable(
  'source_connector_bindings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    connectorId: text('connector_id').notNull(),
    connectionConfig: jsonReq('connection_config'),
    importScope: json<ImportScope | null>('import_scope'),
    lastConfirmedSnapshot: json<Snapshot | null>('last_confirmed_snapshot'),
    lastSyncCheckResult: json<SyncCheckResult | null>('last_sync_check_result'),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [
    index('ix_source_connector_bindings_notebook_id_connector_id').on(t.notebookId, t.connectorId),
  ],
);

export const sourceConnectorBindingRelations = relations(sourceConnectorBindings, ({ one }) => ({
  notebook: one(notebooks, {
    fields: [sourceConnectorBindings.notebookId],
    references: [notebooks.id],
  }),
}));

// ---------------------------------------------------------------------------
// Embedding index rebuild jobs (c131 r480)
// ---------------------------------------------------------------------------

/**
 * Async rebuild jobs for the embedding index. `notebook` mode re-embeds one
 * notebook's ready sources; `global` mode (dimension change — vec_chunks is a
 * single shared vec0 table) recreates the table and re-embeds every notebook.
 * Jobs left `running` by a process restart are marked `interrupted` at boot.
 */
export const indexJobs = sqliteTable(
  'index_jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id').notNull(),
    mode: text('mode', { enum: ['notebook', 'global'] }).notNull(),
    state: text('state', { enum: ['running', 'succeeded', 'failed', 'interrupted'] }).notNull(),
    total: integer('total').notNull().default(0),
    done: integer('done').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    error: text('error'),
    createdAt: ts('created_at'),
    finishedAt: tsNull('finished_at'),
  },
  (t) => [index('ix_index_jobs_notebook_id_id').on(t.notebookId, t.id)],
);
