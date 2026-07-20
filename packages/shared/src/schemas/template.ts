// Template schemas — generation templates (config_json) + prompt presets.
// Mirrors v1 `features.templates` + `features.prompt_presets`.
import { z } from 'zod';

import { IdSchema, IsoTimestampSchema, JsonMetadataSchema } from './common.js';
import { desc } from './i18n.js';

export const TemplateSchema = z
  .object({
    id: IdSchema.describe(desc('template.id')),
    name: z.string().min(1).max(255).describe(desc('template.name')),
    description: z.string().nullable().optional(),
    configJson: JsonMetadataSchema,
    isBuiltin: z.boolean().default(false),
    createdAt: IsoTimestampSchema,
  })
  .openapi({
    description: desc('template.entity', 'Generation template 实体'),
    example: {
      id: 1,
      name: 'Default',
      description: null,
      configJson: {},
      isBuiltin: false,
      createdAt: '2026-07-08T12:00:00.000Z',
    },
  });
export type Template = z.infer<typeof TemplateSchema>;

export const TemplateCreateSchema = z
  .object({
    name: z.string().min(1).max(255).describe(desc('template.name')),
    description: z.string().nullable().optional(),
    configJson: JsonMetadataSchema,
  })
  .openapi({
    description: desc('template.create', '创建 generation template'),
    example: { name: 'Default', configJson: {} },
  });
export type TemplateCreate = z.infer<typeof TemplateCreateSchema>;

export const TemplateListSchema = z.object({
  templates: z.array(TemplateSchema),
});

/** Wire shape for GET /v2/templates (bare array, not wrapped). */
export const TemplateArraySchema = z.array(TemplateSchema);
export type TemplateArray = z.infer<typeof TemplateArraySchema>;

// ---------------------------------------------------------------------------
// Prompt presets (chat `/prompt:<trigger> <query>` directives)
// ---------------------------------------------------------------------------

export const PromptPresetSchema = z
  .object({
    id: IdSchema,
    trigger: z.string().min(1).max(64),
    description: z.string().nullable().optional(),
    systemPrompt: z.string().min(1),
    enabled: z.boolean().default(true),
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
  })
  .openapi({
    description: desc('template.prompt_preset', '聊天 Prompt Preset'),
    example: {
      id: 1,
      trigger: 'eli5',
      description: 'Explain like I am 5',
      systemPrompt: '…',
      enabled: true,
      createdAt: '2026-07-08T12:00:00.000Z',
      updatedAt: '2026-07-08T12:00:00.000Z',
    },
  });
export type PromptPreset = z.infer<typeof PromptPresetSchema>;

export const PromptPresetCreateSchema = z
  .object({
    trigger: z.string().min(1).max(64),
    description: z.string().nullable().optional(),
    systemPrompt: z.string().min(1),
    enabled: z.boolean().default(true),
  })
  .openapi({
    description: desc('template.prompt_preset_create', '创建 Prompt Preset'),
    example: { trigger: 'eli5', systemPrompt: '…' },
  });
export type PromptPresetCreate = z.infer<typeof PromptPresetCreateSchema>;

export const PromptPresetListSchema = z.object({
  presets: z.array(PromptPresetSchema),
});
