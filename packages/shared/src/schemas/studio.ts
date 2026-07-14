// Studio (slides) schemas — slide drafts, stages, generation config.
// Mirrors v1 `features.studio.schemas` + `studio.slides.config`.
import { z } from 'zod';

import {
  IdSchema,
  IsoTimestampSchema,
  JsonMetadataSchema,
  OptionalTimestampSchema,
} from './common.js';
import { SlidesOutlineSchema } from './output.js';

export const SlideStageSchema = z.enum(['input', 'outline', 'markdown']);
export type SlideStage = z.infer<typeof SlideStageSchema>;

export const SlideStatusSchema = z.enum(['idle', 'running', 'error']);
export type SlideStatus = z.infer<typeof SlideStatusSchema>;

export const StudioSlideSchema = z.object({
  id: IdSchema,
  notebook_id: IdSchema,
  output_id: IdSchema.nullable().optional(),
  title: z.string().nullable().optional(),
  prompt: z.string().nullable().optional(),
  engine: z.string().default('slidev'),
  chunk_ids: z.array(IdSchema).nullable().optional(),
  source_ids: z.array(IdSchema).nullable().optional(),
  outline: SlidesOutlineSchema.nullable().optional(),
  markdown: z.string().nullable().optional(),
  generation_config: JsonMetadataSchema.nullable().optional(),
  stage: SlideStageSchema,
  status: SlideStatusSchema,
  error_message: z.string().nullable().optional(),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type StudioSlide = z.infer<typeof StudioSlideSchema>;

export const SlideDraftCreateSchema = z.object({
  title: z.string().nullable().optional(),
  prompt: z.string().nullable().optional(),
  engine: z.string().default('slidev'),
  source_ids: z.array(IdSchema).nullable().optional(),
  generation_config: JsonMetadataSchema.nullable().optional(),
});
export type SlideDraftCreate = z.infer<typeof SlideDraftCreateSchema>;

export const SlideDraftUpdateSchema = z.object({
  title: z.string().nullable().optional(),
  prompt: z.string().nullable().optional(),
  engine: z.string().optional(),
  source_ids: z.array(IdSchema).nullable().optional(),
  generation_config: JsonMetadataSchema.nullable().optional(),
  outline: SlidesOutlineSchema.nullable().optional(),
  markdown: z.string().nullable().optional(),
  stage: SlideStageSchema.optional(),
});
export type SlideDraftUpdate = z.infer<typeof SlideDraftUpdateSchema>;

export const StudioSlideListSchema = z.object({
  slides: z.array(StudioSlideSchema),
});

// ---------------------------------------------------------------------------
// c56: Slide generation config + config_schema (v1 PluginConfigSchema parity).
// Drives the workspace /tools config_schema contract (workspace-api-contract r20)
// and studio generation prompt/retrieval interpretation.
// ---------------------------------------------------------------------------

/** v1 schemas.py:28-39 SlideGenerationConfig (typed subset). */
export const SlideGenerationConfigSchema = z.object({
  preference: z.enum(['quality', 'speed']).nullable().optional(),
  quantity: z.string().nullable().optional(),
  audience: z.string().nullable().optional(),
  structure: z.string().nullable().optional(),
  tone: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  density: z.string().nullable().optional(),
  theme_preset: z.string().nullable().optional(),
  frontmatter: z.string().nullable().optional(),
});
export type SlideGenerationConfig = z.infer<typeof SlideGenerationConfigSchema>;

/** v1 render_types.py ConfigOption — one selectable value for a config axis. */
export const ConfigOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  is_default: z.boolean().default(false),
});
export type ConfigOption = z.infer<typeof ConfigOptionSchema>;

/** v1 render_types.py ThemePresetOption — option carrying a frontmatter template. */
export const ThemePresetOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  template: JsonMetadataSchema.default({}),
});
export type ThemePresetOption = z.infer<typeof ThemePresetOptionSchema>;

/**
 * v1 render_types.py PluginConfigSchema — the shape returned by
 * /workspace/tools[].config_schema and /workspace/tools/:id/config for SLIDES.
 * Drives the frontend config UI directly (workspace-api-contract r20).
 */
export const SlidesConfigSchemaSchema = z.object({
  defaults: JsonMetadataSchema.default({}),
  quantity_options: z.array(ConfigOptionSchema).default([]),
  audience_options: z.array(ConfigOptionSchema).default([]),
  structure_options: z.array(ConfigOptionSchema).default([]),
  tone_options: z.array(ConfigOptionSchema).default([]),
  language_options: z.array(ConfigOptionSchema).default([]),
  density_options: z.array(ConfigOptionSchema).default([]),
  theme_preset_options: z.array(ThemePresetOptionSchema).default([]),
  engine: z.string().nullable().optional(),
  preview: z
    .object({
      kind: z.string(),
      service: z.string().nullable().optional(),
      url: z.string().nullable().optional(),
      open_in_new_tab: z.boolean().nullable().optional(),
      meta: z.record(z.string(), z.unknown()).default({}),
    })
    .nullable()
    .optional(),
});
export type SlidesConfigSchema = z.infer<typeof SlidesConfigSchemaSchema>;

/** Re-export so consumers can import slide outline shape from one place. */
export { SlidesOutlineSchema };

/** Optional marker kept for parity with v1 last_error_at pattern. */
export const _SlideOptionalTimestamp = OptionalTimestampSchema;
