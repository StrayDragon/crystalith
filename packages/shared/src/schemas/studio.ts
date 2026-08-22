// Studio (slides) schemas — slide drafts, stages, generation config.
// Mirrors v1 `features.studio.schemas` + `studio.slides.config`.
import { z } from 'zod';

import { IdSchema, IsoTimestampSchema, JsonMetadataSchema } from './common.js';
import { desc } from './i18n.js';
import { SlidesOutlineSchema } from './output.js';

export const SlideStageSchema = z.enum(['input', 'outline', 'markdown']);
export type SlideStage = z.infer<typeof SlideStageSchema>;

export const SlideStatusSchema = z.enum(['idle', 'running', 'error']);
export type SlideStatus = z.infer<typeof SlideStatusSchema>;

export const StudioSlideSchema = z
  .object({
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
  })
  .openapi({
    description: desc('studio.slide', '幻灯片草稿实体'),
    example: {
      id: 1,
      notebookId: 1,
      title: 'Demo',
      engine: 'slidev',
      stage: 'input',
      status: 'idle',
      createdAt: '2026-07-08T12:00:00.000Z',
      updatedAt: '2026-07-08T12:00:00.000Z',
    },
  });
export type StudioSlide = z.infer<typeof StudioSlideSchema>;

export const SlideDraftCreateSchema = z
  .object({
    title: z.string().nullable().optional(),
    prompt: z.string().nullable().optional(),
    engine: z.string().default('slidev'),
    sourceIds: z.array(IdSchema).nullable().optional(),
    generationConfig: JsonMetadataSchema.nullable().optional(),
  })
  .openapi({
    description: desc('studio.slide_create', '创建幻灯片草稿'),
  });
export type SlideDraftCreate = z.infer<typeof SlideDraftCreateSchema>;

/** Create-draft body without notebook scope. */
export const SlideDraftCreateBodySchema = z
  .object({
    title: z.string().nullable().optional(),
    prompt: z.string().nullable().optional(),
    /** Defaults to `slidev` in the studio router when omitted (kept optional for Eden clients). */
    engine: z.string().optional(),
    sourceIds: z.array(IdSchema).min(1),
    generationConfig: JsonMetadataSchema.nullable().optional(),
  })
  .openapi({
    description: desc('studio.slide_create_body', '创建幻灯片草稿请求体'),
    example: { title: 'Demo', sourceIds: [1] },
  });
export type SlideDraftCreateBody = z.infer<typeof SlideDraftCreateBodySchema>;

/** Nested POST /v2/notebooks/:nid/studio/slides — optional body notebookId must match path. */
export const SlideDraftCreateNestedRequestSchema = SlideDraftCreateBodySchema.extend({
  notebookId: IdSchema.optional(),
}).openapi({
  description: desc('studio.slide_create_nested', '创建幻灯片草稿（nested）'),
});
export type SlideDraftCreateNestedRequest = z.infer<typeof SlideDraftCreateNestedRequestSchema>;

export const SlideDraftUpdateSchema = z
  .object({
    title: z.string().nullable().optional(),
    prompt: z.string().nullable().optional(),
    engine: z.string().optional(),
    sourceIds: z.array(IdSchema).min(1).nullable().optional(),
    generationConfig: JsonMetadataSchema.nullable().optional(),
    outline: SlidesOutlineSchema.nullable().optional(),
    markdown: z.string().nullable().optional(),
    stage: SlideStageSchema.optional(),
  })
  .openapi({
    description: desc('studio.slide_update', '更新幻灯片草稿'),
  });
export type SlideDraftUpdate = z.infer<typeof SlideDraftUpdateSchema>;

export const StudioSlideListSchema = z.object({
  slides: z.array(StudioSlideSchema),
});

export const StudioOutlinePutSchema = z.object({
  outline: SlidesOutlineSchema,
});
export type StudioOutlinePut = z.infer<typeof StudioOutlinePutSchema>;

export const StudioMarkdownPutSchema = z.object({
  markdown: z.string(),
});
export type StudioMarkdownPut = z.infer<typeof StudioMarkdownPutSchema>;

// ---------------------------------------------------------------------------
// c56: Slide generation config + config_schema (v1 PluginConfigSchema parity).
// Drives the workspace /tools config_schema contract (workspace-api-contract r20)
// and studio generation prompt/retrieval interpretation.
// ---------------------------------------------------------------------------

/** v1 schemas.py:28-39 SlideGenerationConfig (typed subset). */
export const SlideGenerationConfigSchema = z
  .object({
    preference: z.enum(['quality', 'speed']).nullable().optional(),
    quantity: z.string().nullable().optional(),
    audience: z.string().nullable().optional(),
    structure: z.string().nullable().optional(),
    tone: z.string().nullable().optional(),
    language: z.string().nullable().optional(),
    density: z.string().nullable().optional(),
    themePreset: z.string().nullable().optional(),
    frontmatter: z.string().nullable().optional(),
  })
  .openapi({
    description: desc('studio.generation_config', '幻灯片生成配置'),
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

/** Preview descriptor for opening generated slides in an external service. */
export const PreviewDescriptorSchema = z.object({
  kind: z.string(),
  service: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  openInNewTab: z.boolean().nullable().optional(),
  meta: z.record(z.string(), z.unknown()).default({}),
});
export type PreviewDescriptor = z.infer<typeof PreviewDescriptorSchema>;

/**
 * v1 render_types.py PluginConfigSchema — the shape returned by
 * /workspace/tools[].config_schema and /workspace/tools/:id/config for SLIDES.
 * Drives the frontend config UI directly (workspace-api-contract r20).
 */
export const SlidesConfigSchemaSchema = z
  .object({
    defaults: SlideGenerationConfigSchema.partial().default({}),
    quantityOptions: z.array(ConfigOptionSchema).default([]),
    difficultyOptions: z.array(ConfigOptionSchema).default([]),
    audienceOptions: z.array(ConfigOptionSchema).default([]),
    structureOptions: z.array(ConfigOptionSchema).default([]),
    toneOptions: z.array(ConfigOptionSchema).default([]),
    languageOptions: z.array(ConfigOptionSchema).default([]),
    densityOptions: z.array(ConfigOptionSchema).default([]),
    themePresetOptions: z.array(ThemePresetOptionSchema).default([]),
    topicPlaceholder: z.string().default(''),
    supportsTopic: z.boolean().default(false),
    engine: z.string().nullable().optional(),
    preview: PreviewDescriptorSchema.nullable().optional(),
  })
  .openapi({
    description: desc('studio.config_schema', '幻灯片工具 config_schema'),
  });
export type SlidesConfigSchema = z.infer<typeof SlidesConfigSchemaSchema>;

/** Wire alias — same shape as SlidesConfigSchema (workspace tools naming). */
export const PluginConfigSchema = SlidesConfigSchemaSchema;
export type PluginConfig = SlidesConfigSchema;

/** Re-export so consumers can import slide outline shape from one place. */
export { SlidesOutlineSchema };
