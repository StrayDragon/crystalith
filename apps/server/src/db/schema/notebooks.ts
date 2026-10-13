// Notebook domain — the ownership hub every other domain FKs into. Its
// cross-domain `many()` relations live in the schema barrel (schema.ts).
import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { ts, tsUpd } from './columns.ts';

export const notebooks = sqliteTable(
  'notebooks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [index('ix_notebooks_name').on(t.name)],
);

// ---------------------------------------------------------------------------
// Notebook extractor policies (1:1 with notebook via PK)
// ---------------------------------------------------------------------------

export const notebookExtractorPolicies = sqliteTable('notebook_extractor_policies', {
  notebookId: integer('notebook_id')
    .primaryKey()
    .references(() => notebooks.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull().default('inherit_global'),
  enabledExtractors: text('enabled_extractors', { mode: 'json' }).$type<string[] | null>(),
  createdAt: ts('created_at'),
  updatedAt: tsUpd('updated_at'),
});

// ---------------------------------------------------------------------------
// RAG strategy configs (per-notebook enabled strategy IDs)
// ---------------------------------------------------------------------------

/** Persisted enabled RAG strategies per notebook (was ad-hoc in rag/registry). */
export const strategyConfigs = sqliteTable(
  'strategy_configs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id').notNull(),
    strategyId: text('strategy_id').notNull(),
  },
  (t) => [index('ix_strategy_configs_notebook_id').on(t.notebookId)],
);

export const strategyConfigRelations = relations(strategyConfigs, ({ one }) => ({
  notebook: one(notebooks, {
    fields: [strategyConfigs.notebookId],
    references: [notebooks.id],
  }),
}));
