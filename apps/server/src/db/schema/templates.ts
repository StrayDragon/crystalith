// Templates + Prompt presets — standalone (no notebook FK).
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { bool, jsonReq, ts, tsUpd } from './columns.ts';

export const templates = sqliteTable(
  'templates',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description'),
    configJson: jsonReq('config_json'),
    isBuiltin: bool('is_builtin', false),
    createdAt: ts('created_at'),
  },
  (t) => [index('ix_templates_is_builtin').on(t.isBuiltin)],
);

export const promptPresets = sqliteTable(
  'prompt_presets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    trigger: text('trigger').notNull().unique(),
    description: text('description'),
    systemPrompt: text('system_prompt').notNull(),
    enabled: bool('enabled', true),
    /** Owning generation type (c122 r188); only preset-capable types accept creation. */
    generationTypeId: text('generation_type_id', { enum: ['qa', 'output', 'slides'] })
      .notNull()
      .default('qa'),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [
    index('ix_prompt_presets_enabled').on(t.enabled),
    index('ix_prompt_presets_trigger').on(t.trigger),
  ],
);
