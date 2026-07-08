// Output schemas — typed generation framework.
// Content shapes mirror the frontend `OutputContentByType` contract exactly so
// the v2 server can feed the existing renderers without translation.
import { z } from "zod";
import { IdSchema, IsoTimestampSchema, JsonMetadataSchema } from "./common.js";

// ---------------------------------------------------------------------------
// Output type enum (10 types — 7 tools + 3 summary styles)
// ---------------------------------------------------------------------------

export const OutputTypeSchema = z.enum([
  "FAQ",
  "GUIDE",
  "TIMELINE",
  "MINDMAP",
  "QUIZ",
  "BRIEFING",
  "SLIDES",
  "PARAGRAPH",
  "BULLETS",
  "STRUCTURED",
]);
export type OutputType = z.infer<typeof OutputTypeSchema>;

/** The 7 "tool" output types that have dedicated generators + renderers. */
export const ToolOutputTypeSchema = z.enum([
  "FAQ",
  "GUIDE",
  "TIMELINE",
  "MINDMAP",
  "QUIZ",
  "BRIEFING",
  "SLIDES",
]);
export type ToolOutputType = z.infer<typeof ToolOutputTypeSchema>;

// ---------------------------------------------------------------------------
// Shared base — mirrors frontend `OutputContentBase`
// ---------------------------------------------------------------------------

const OutputContentBaseSchema = z.object({
  title: z.string().nullable().optional(),
  _fallback: z.boolean().optional(),
  _warnings: z.array(z.string()).optional(),
});

const nullableText = z.string().nullable().optional();
const textItem = z.object({ text: nullableText });

// ---------------------------------------------------------------------------
// Per-type content schemas
// ---------------------------------------------------------------------------

export const FaqContentSchema = OutputContentBaseSchema.extend({
  items: z.array(
    z.object({
      question: nullableText,
      answer: nullableText,
    }),
  ),
});
export type FaqContent = z.infer<typeof FaqContentSchema>;

export const GuideContentSchema = OutputContentBaseSchema.extend({
  modules: z.array(
    z.object({
      title: nullableText,
      objective: z.object({ text: nullableText }).nullable().optional(),
      key_points: z.array(textItem).nullable().optional(),
    }),
  ),
});
export type GuideContent = z.infer<typeof GuideContentSchema>;

export const TimelineContentSchema = OutputContentBaseSchema.extend({
  events: z.array(
    z.object({
      date: nullableText,
      event: nullableText,
      description: nullableText,
    }),
  ),
});
export type TimelineContent = z.infer<typeof TimelineContentSchema>;

export const MindmapOutputNodeSchema: z.ZodType<{
  label?: string | null;
  children?: Array<z.infer<typeof MindmapOutputNodeSchema>> | null;
}> = z.lazy(() =>
  z.object({
    label: nullableText,
    children: z.array(MindmapOutputNodeSchema).nullable().optional(),
  }),
);
export type MindmapOutputNode = z.infer<typeof MindmapOutputNodeSchema>;

export const MindmapContentSchema = OutputContentBaseSchema.extend({
  root: MindmapOutputNodeSchema,
});
export type MindmapContent = z.infer<typeof MindmapContentSchema>;

export const QuizContentSchema = OutputContentBaseSchema.extend({
  questions: z.array(
    z.object({
      question: nullableText,
      options: z.array(z.string()).nullable().optional(),
      answer: z.union([z.string(), z.array(z.string())]).nullable().optional(),
      explanation: nullableText,
    }),
  ),
});
export type QuizContent = z.infer<typeof QuizContentSchema>;

export const BriefingContentSchema = OutputContentBaseSchema.extend({
  sections: z.array(
    z.object({
      heading: nullableText,
      points: z.array(textItem).nullable().optional(),
    }),
  ),
});
export type BriefingContent = z.infer<typeof BriefingContentSchema>;

export const SlidesOutlineSchema = z.object({
  title: nullableText,
  slides: z
    .array(
      z.object({
        title: nullableText,
        bullets: z.array(z.string()).nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
});

export const SlidesContentSchema = OutputContentBaseSchema.extend({
  slide_id: z.number().int().nullable().optional(),
  engine: z.string().nullable().optional(),
  outline: SlidesOutlineSchema.nullable().optional(),
  markdown: z.string().nullable().optional(),
});
export type SlidesContent = z.infer<typeof SlidesContentSchema>;

export const ParagraphContentSchema = OutputContentBaseSchema.extend({
  text: z.string(),
});
export type ParagraphContent = z.infer<typeof ParagraphContentSchema>;

export const BulletsContentSchema = OutputContentBaseSchema.extend({
  items: z.array(z.union([z.string(), textItem])),
});
export type BulletsContent = z.infer<typeof BulletsContentSchema>;

export const StructuredContentSchema = OutputContentBaseSchema.extend({
  bullets: z.array(z.union([z.string(), textItem])).nullable().optional(),
  terms: z.array(z.string()).nullable().optional(),
});
export type StructuredContent = z.infer<typeof StructuredContentSchema>;

// ---------------------------------------------------------------------------
// Discriminated-by-type content union (for typed generation requests)
// ---------------------------------------------------------------------------

export const TypedOutputContentSchema = z.discriminatedUnion("type", [
  FaqContentSchema.extend({ type: z.literal("FAQ") }),
  GuideContentSchema.extend({ type: z.literal("GUIDE") }),
  TimelineContentSchema.extend({ type: z.literal("TIMELINE") }),
  MindmapContentSchema.extend({ type: z.literal("MINDMAP") }),
  QuizContentSchema.extend({ type: z.literal("QUIZ") }),
  BriefingContentSchema.extend({ type: z.literal("BRIEFING") }),
  SlidesContentSchema.extend({ type: z.literal("SLIDES") }),
  ParagraphContentSchema.extend({ type: z.literal("PARAGRAPH") }),
  BulletsContentSchema.extend({ type: z.literal("BULLETS") }),
  StructuredContentSchema.extend({ type: z.literal("STRUCTURED") }),
]);

/** Lookup map: type → content schema (used by generateObject dispatch). */
export const OutputContentSchemaByType = {
  FAQ: FaqContentSchema,
  GUIDE: GuideContentSchema,
  TIMELINE: TimelineContentSchema,
  MINDMAP: MindmapContentSchema,
  QUIZ: QuizContentSchema,
  BRIEFING: BriefingContentSchema,
  SLIDES: SlidesContentSchema,
  PARAGRAPH: ParagraphContentSchema,
  BULLETS: BulletsContentSchema,
  STRUCTURED: StructuredContentSchema,
} as const;

/** Loose content payload stored on the outputs row (type-erased JSON). */
export const OutputContentSchema = JsonMetadataSchema;
export type OutputContent = z.infer<typeof OutputContentSchema>;

// ---------------------------------------------------------------------------
// Output entity + request
// ---------------------------------------------------------------------------

export const OutputSchema = z.object({
  id: IdSchema,
  notebook_id: IdSchema,
  type: OutputTypeSchema,
  prompt: z.string().nullable().optional(),
  chunk_ids: z.array(IdSchema).nullable().optional(),
  content: OutputContentSchema,
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type Output = z.infer<typeof OutputSchema>;

export const OutputGenerateRequestSchema = z.object({
  prompt: z.string().nullable().optional(),
  content: OutputContentSchema.nullable().optional(),
});
export type OutputGenerateRequest = z.infer<typeof OutputGenerateRequestSchema>;

export const OutputListSchema = z.object({
  outputs: z.array(OutputSchema),
});

/** Metadata describing an output type for UI selectors (tone/prompt/is_tool). */
export const OutputTypeMetaSchema = z.object({
  type: OutputTypeSchema,
  display_text: z.string(),
  description: z.string(),
  tone: z.string(),
  prompt: z.string(),
  is_tool: z.boolean(),
});
export type OutputTypeMeta = z.infer<typeof OutputTypeMetaSchema>;
