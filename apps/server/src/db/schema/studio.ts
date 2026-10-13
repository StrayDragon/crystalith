// Studio slides domain (Slidev workflow).
import type { SlideGenerationConfig, SlidesOutline } from '@crystalith/shared';
import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { json, ts, tsUpd } from './columns.ts';
import { notebooks } from './notebooks.ts';
import { outputs } from './outputs.ts';

export const studioSlides = sqliteTable(
  'studio_slides',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    outputId: integer('output_id').references(() => outputs.id, { onDelete: 'set null' }),
    title: text('title'),
    prompt: text('prompt'),
    engine: text('engine').notNull().default('slidev'),
    chunkIds: text('chunk_ids', { mode: 'json' }).$type<number[] | null>(),
    sourceIds: text('source_ids', { mode: 'json' }).$type<number[] | null>(),
    outline: json<SlidesOutline | null>('outline'),
    markdown: text('markdown'),
    generationConfig: json<SlideGenerationConfig | null>('generation_config'),
    stage: text('stage', { enum: ['input', 'outline', 'markdown'] })
      .notNull()
      .default('input'),
    status: text('status', { enum: ['idle', 'running', 'error'] })
      .notNull()
      .default('idle'),
    errorMessage: text('error_message'),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [index('ix_studio_slides_notebook_id_updated_at').on(t.notebookId, t.updatedAt)],
);

export const studioSlideRelations = relations(studioSlides, ({ one }) => ({
  notebook: one(notebooks, { fields: [studioSlides.notebookId], references: [notebooks.id] }),
  output: one(outputs, { fields: [studioSlides.outputId], references: [outputs.id] }),
}));
