// Template schemas — generation templates (config_json) + prompt presets.
// Mirrors v1 `features.templates` + `features.prompt_presets`.
import { z } from 'zod';

import { IdSchema, IsoTimestampSchema, JsonMetadataSchema } from './common.js';
import { desc } from './i18n.js';

export const TemplateSchema = z.object({
  id: IdSchema.describe(desc('template.id')),
  name: z.string().min(1).max(255).describe(desc('template.name')),
  description: z.string().nullable().optional(),
  config_json: JsonMetadataSchema,
  is_builtin: z.boolean().default(false),
  created_at: IsoTimestampSchema,
});
export type Template = z.infer<typeof TemplateSchema>;

export const TemplateCreateSchema = z.object({
  name: z.string().min(1).max(255).describe(desc('template.name')),
  description: z.string().nullable().optional(),
  config_json: JsonMetadataSchema,
});
export type TemplateCreate = z.infer<typeof TemplateCreateSchema>;

export const TemplateListSchema = z.object({
  templates: z.array(TemplateSchema),
});

// ---------------------------------------------------------------------------
// Prompt presets (chat `/prompt:<trigger> <query>` directives)
// ---------------------------------------------------------------------------

export const PromptPresetSchema = z.object({
  id: IdSchema,
  trigger: z.string().min(1).max(64),
  description: z.string().nullable().optional(),
  system_prompt: z.string().min(1),
  enabled: z.boolean().default(true),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type PromptPreset = z.infer<typeof PromptPresetSchema>;

export const PromptPresetCreateSchema = z.object({
  trigger: z.string().min(1).max(64),
  description: z.string().nullable().optional(),
  system_prompt: z.string().min(1),
  enabled: z.boolean().default(true),
});
export type PromptPresetCreate = z.infer<typeof PromptPresetCreateSchema>;

export const PromptPresetListSchema = z.object({
  presets: z.array(PromptPresetSchema),
});
