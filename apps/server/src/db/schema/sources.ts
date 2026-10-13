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
