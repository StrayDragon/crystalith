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
  notebookId: IdSchema,
  outputId: IdSchema.nullable().optional(),
  title: z.string().nullable().optional(),
  prompt: z.string().nullable().optional(),
  engine: z.string().default('slidev'),
  chunkIds: z.array(IdSchema).nullable().optional(),
  sourceIds: z.array(IdSchema).nullable().optional(),
  outline: SlidesOutlineSchema.nullable().optional(),
  markdown: z.string().nullable().optional(),
  generationConfig: JsonMetadataSchema.nullable().optional(),
  stage: SlideStageSchema,
  status: SlideStatusSchema,
  errorMessage: z.string().nullable().optional(),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});
export type StudioSlide = z.infer<typeof StudioSlideSchema>;

export const SlideDraftCreateSchema = z.object({
  title: z.string().nullable().optional(),
  prompt: z.string().nullable().optional(),
  engine: z.string().default('slidev'),
  sourceIds: z.array(IdSchema).nullable().optional(),
  generationConfig: JsonMetadataSchema.nullable().optional(),
});
export type SlideDraftCreate = z.infer<typeof SlideDraftCreateSchema>;

export const SlideDraftUpdateSchema = z.object({
  title: z.string().nullable().optional(),
  prompt: z.string().nullable().optional(),
  engine: z.string().optional(),
  sourceIds: z.array(IdSchema).nullable().optional(),
  generationConfig: JsonMetadataSchema.nullable().optional(),
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
  themePreset: z.string().nullable().optional(),
  frontmatter: z.string().nullable().optional(),
});
export type SlideGenerationConfig = z.infer<typeof SlideGenerationConfigSchema>;

/** v1 render_types.py ConfigOption — one selectable value for a config axis. */
export const ConfigOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  isDefault: z.boolean().default(false),
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
  quantityOptions: z.array(ConfigOptionSchema).default([]),
  audienceOptions: z.array(ConfigOptionSchema).default([]),
  structureOptions: z.array(ConfigOptionSchema).default([]),
  toneOptions: z.array(ConfigOptionSchema).default([]),
  languageOptions: z.array(ConfigOptionSchema).default([]),
  densityOptions: z.array(ConfigOptionSchema).default([]),
  themePresetOptions: z.array(ThemePresetOptionSchema).default([]),
  engine: z.string().nullable().optional(),
  preview: z
    .object({
      kind: z.string(),
      service: z.string().nullable().optional(),
      url: z.string().nullable().optional(),
      openInNewTab: z.boolean().nullable().optional(),
      meta: z.record(z.string(), z.unknown()).default({}),
    })
    .nullable()
    .optional(),
});
export type SlidesConfigSchema = z.infer<typeof SlidesConfigSchemaSchema>;

/** Re-export so consumers can import slide outline shape from one place. */
export { SlidesOutlineSchema };

/** Optional marker kept for parity with v1 lastErrorAt pattern. */
export const _SlideOptionalTimestamp = OptionalTimestampSchema;
