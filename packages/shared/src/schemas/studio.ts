// Studio (slides) schemas — slide drafts, stages, generation config.
// Mirrors v1 `features.studio.schemas` + `studio.slides.config`.
import { z } from "zod";
import {
  IdSchema,
  IsoTimestampSchema,
  JsonMetadataSchema,
  OptionalTimestampSchema,
} from "./common.js";
import { SlidesOutlineSchema } from "./output.js";

export const SlideStageSchema = z.enum(["input", "outline", "markdown"]);
export type SlideStage = z.infer<typeof SlideStageSchema>;

export const SlideStatusSchema = z.enum(["idle", "running", "error"]);
export type SlideStatus = z.infer<typeof SlideStatusSchema>;

export const StudioSlideSchema = z.object({
  id: IdSchema,
  notebook_id: IdSchema,
  output_id: IdSchema.nullable().optional(),
  title: z.string().nullable().optional(),
  prompt: z.string().nullable().optional(),
  engine: z.string().default("slidev"),
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
  engine: z.string().default("slidev"),
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

/** Re-export so consumers can import slide outline shape from one place. */
export { SlidesOutlineSchema };

/** Optional marker kept for parity with v1 last_error_at pattern. */
export const _SlideOptionalTimestamp = OptionalTimestampSchema;
