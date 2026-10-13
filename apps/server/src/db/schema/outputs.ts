// Outputs domain (generation results). Its cross-domain `slides` relation
// lives in the schema barrel (schema.ts).
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { jsonReq, ts, tsUpd } from './columns.ts';
import { notebooks } from './notebooks.ts';

export const outputs = sqliteTable(
  'outputs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: [
        'FAQ',
        'GUIDE',
        'TIMELINE',
        'MINDMAP',
        'QUIZ',
        'BRIEFING',
        'SLIDES',
        'PARAGRAPH',
        'BULLETS',
        'STRUCTURED',
      ],
    }).notNull(),
    prompt: text('prompt'),
    chunkIds: text('chunk_ids', { mode: 'json' }).$type<number[] | null>(),
    /** Effective-generation metadata (c122 r326): {generationTypeId, outputType, completion, effectiveControls}. */
    generationMeta: text('generation_meta', { mode: 'json' }).$type<{
      generationTypeId: 'qa' | 'output' | 'slides';
      outputType: string;
      completion: string;
      effectiveControls?: Record<string, unknown> | null;
    } | null>(),
    content: jsonReq('content'),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [index('ix_outputs_notebook_id_created_at').on(t.notebookId, t.createdAt)],
);
