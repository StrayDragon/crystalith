// Output schemas — typed generation framework.
// Content shapes mirror the frontend `OutputContentByType` contract exactly so
// the v2 server can feed the existing renderers without translation.
import { z } from 'zod';

import {
  CitationSchema,
  IdSchema,
  IsoTimestampSchema,
  JsonMetadataSchema,
  PaginatedSchema,
} from './common.js';
import { desc } from './i18n.js';

// ---------------------------------------------------------------------------
// Output type enum (10 types — 7 tools + 3 summary styles)
// ---------------------------------------------------------------------------

export const OutputTypeSchema = z.enum([
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
]);
export type OutputType = z.infer<typeof OutputTypeSchema>;

// ---------------------------------------------------------------------------
// Studio tone — color theme for output type cards (shared frontend/server)
// ---------------------------------------------------------------------------

/** Valid tone values that both server and frontend recognize. */
export const StudioToneSchema = z.enum([
  'slate',
  'blue',
  'green',
  'rose',
  'amber',
  'teal',
  'indigo',
]);
export type StudioTone = z.infer<typeof StudioToneSchema>;

/** The 7 "tool" output types that have dedicated generators + renderers. */
export const ToolOutputTypeSchema = z.enum([
  'FAQ',
  'GUIDE',
  'TIMELINE',
  'MINDMAP',
  'QUIZ',
  'BRIEFING',
  'SLIDES',
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
      keyPoints: z.array(textItem).nullable().optional(),
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
      answer: z
        .union([z.string(), z.array(z.string())])
        .nullable()
        .optional(),
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
export type SlidesOutline = z.infer<typeof SlidesOutlineSchema>;

export const SlidesContentSchema = OutputContentBaseSchema.extend({
  slideId: z.number().int().nullable().optional(),
  engine: z.string().nullable().optional(),
  outline: SlidesOutlineSchema.nullable().optional(),
  markdown: z.string().nullable().optional(),
});
export type SlidesContent = z.infer<typeof SlidesContentSchema>;

/** Optional origin for notes converted from Deep Research (兜底跳转 Lab 报告). */
export const ResearchLabOriginSchema = z
  .object({
    notebookId: z.number().int().positive(),
    runId: z.number().int().positive(),
    artifactKind: z.enum(['report', 'node', 'evidence']).optional(),
  })
  .openapi({ description: desc('output.research_lab_origin', '深度研究转化来源（可选）') });
export type ResearchLabOrigin = z.infer<typeof ResearchLabOriginSchema>;

export const ParagraphContentSchema = OutputContentBaseSchema.extend({
  text: z.string(),
  researchLab: ResearchLabOriginSchema.optional(),
});
export type ParagraphContent = z.infer<typeof ParagraphContentSchema>;

export const BulletsContentSchema = OutputContentBaseSchema.extend({
  items: z.array(z.union([z.string(), textItem])),
});
export type BulletsContent = z.infer<typeof BulletsContentSchema>;

export const StructuredContentSchema = OutputContentBaseSchema.extend({
  bullets: z
    .array(z.union([z.string(), textItem]))
    .nullable()
    .optional(),
  terms: z.array(z.string()).nullable().optional(),
});
export type StructuredContent = z.infer<typeof StructuredContentSchema>;

// ---------------------------------------------------------------------------
// Discriminated-by-type content union (for typed generation requests)
// ---------------------------------------------------------------------------

export const TypedOutputContentSchema = z.discriminatedUnion('type', [
  FaqContentSchema.extend({ type: z.literal('FAQ') }),
  GuideContentSchema.extend({ type: z.literal('GUIDE') }),
  TimelineContentSchema.extend({ type: z.literal('TIMELINE') }),
  MindmapContentSchema.extend({ type: z.literal('MINDMAP') }),
  QuizContentSchema.extend({ type: z.literal('QUIZ') }),
  BriefingContentSchema.extend({ type: z.literal('BRIEFING') }),
  SlidesContentSchema.extend({ type: z.literal('SLIDES') }),
  ParagraphContentSchema.extend({ type: z.literal('PARAGRAPH') }),
  BulletsContentSchema.extend({ type: z.literal('BULLETS') }),
  StructuredContentSchema.extend({ type: z.literal('STRUCTURED') }),
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

/** Type-level map: output type → content shape (web/server UI + guards). */
export type OutputContentByType = {
  FAQ: FaqContent;
  GUIDE: GuideContent;
  TIMELINE: TimelineContent;
  MINDMAP: MindmapContent;
  QUIZ: QuizContent;
  BRIEFING: BriefingContent;
  SLIDES: SlidesContent;
  PARAGRAPH: ParagraphContent;
  BULLETS: BulletsContent;
  STRUCTURED: StructuredContent;
};

/** Web-facing aliases (historical `*OutputContent` names). */
export type FAQOutputContent = FaqContent;
export type GuideOutputContent = GuideContent;
export type TimelineOutputContent = TimelineContent;
export type MindmapOutputContent = MindmapContent;
export type QuizOutputContent = QuizContent;
export type BriefingOutputContent = BriefingContent;
export type SlidesOutputContent = SlidesContent;
export type ParagraphOutputContent = ParagraphContent;
export type BulletsOutputContent = BulletsContent;
export type StructuredOutputContent = StructuredContent;
export type OutputContentBase = z.infer<typeof OutputContentBaseSchema>;

/** Loose content payload stored on the outputs row (type-erased JSON). */
export const OutputContentSchema = JsonMetadataSchema;
export type OutputContent = z.infer<typeof OutputContentSchema>;

// ---------------------------------------------------------------------------
// Output entity + request
// ---------------------------------------------------------------------------

export const OutputSchema = z
  .object({
    id: IdSchema.describe(desc('output.id')),
    notebookId: IdSchema,
    type: OutputTypeSchema.describe(desc('output.type')),
    prompt: z.string().nullable().optional(),
    chunkIds: z.array(IdSchema).nullable().optional(),
    sourceIds: z
      .array(IdSchema)
      .nullable()
      .optional()
      .describe(desc('output.source_ids', '生成时选中的来源 ID 列表')),
    content: OutputContentSchema.describe(desc('output.content')),
    createdAt: IsoTimestampSchema.describe(desc('output.created_at')),
    updatedAt: IsoTimestampSchema,
  })
  .openapi({
    description: desc('output.entity', '输出实体（含完整 content）'),
    example: {
      id: 1,
      notebookId: 1,
      type: 'FAQ',
      prompt: '生成 FAQ',
      chunkIds: [1],
      content: { title: 'FAQ', items: [] },
      createdAt: '2026-07-08T12:00:00.000Z',
      updatedAt: '2026-07-08T12:00:00.000Z',
    },
  });
export type Output = z.infer<typeof OutputSchema>;

/**
 * List-row projection (c72): metadata + short preview only — MUST NOT include full content.
 * Title/slideId are derived server-side from stored content then content is omitted.
 */
export const OutputListItemSchema = z
  .object({
    id: IdSchema.describe(desc('output.id')),
    notebookId: IdSchema,
    type: OutputTypeSchema.describe(desc('output.type')),
    prompt: z.string().nullable().optional(),
    title: z
      .string()
      .nullable()
      .optional()
      .describe(desc('output.title', '列表展示标题（由正文/prompt 派生）')),
    preview: z
      .string()
      .nullable()
      .optional()
      .describe(desc('output.preview', '短预览文本（截断）')),
    slideId: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional()
      .describe(desc('output.slide_id', 'SLIDES 类型关联的草稿 ID（列表用）')),
    chunkIds: z.array(IdSchema).nullable().optional(),
    sourceIds: z
      .array(IdSchema)
      .nullable()
      .optional()
      .describe(desc('output.source_ids', '生成时选中的来源 ID 列表')),
    researchLab: ResearchLabOriginSchema.optional().describe(
      desc('output.list_research_lab', '深度研究转化来源（列表兜底跳转）'),
    ),
    createdAt: IsoTimestampSchema.describe(desc('output.created_at')),
    updatedAt: IsoTimestampSchema,
  })
  .openapi({
    description: desc('output.list_item', '输出列表项（无完整 content）'),
  });
export type OutputListItem = z.infer<typeof OutputListItemSchema>;

/** Paginated list envelope for GET outputs (c68 + c72 thin items). */
export const OutputsPageSchema = PaginatedSchema(OutputListItemSchema);
export type OutputsPage = z.infer<typeof OutputsPageSchema>;

/** Body fields for generate (without notebook scope). */
export const OutputGenerateBodySchema = z
  .object({
    /** Output type id; accepts lower/upper case (normalized server-side). */
    type: z.string().min(1),
    prompt: z.string().nullable().optional(),
    /** Display title persisted into content.title (e.g. the caller's tool label). */
    title: z.string().min(1).max(120).nullable().optional().describe(desc('output.generate_title')),
    content: OutputContentSchema.nullable().optional(),
    sourceIds: z.array(IdSchema).optional(),
    chunkIds: z.array(IdSchema).optional(),
    preference: z.enum(['quality', 'speed']).nullable().optional(),
    topK: z.number().int().positive().max(50).optional(),
    minScore: z.number().min(0).max(1).optional(),
    modelId: z.string().optional(),
  })
  .openapi({
    description: desc('output.generate_body', '生成输出请求体'),
    example: { type: 'FAQ', prompt: '总结要点', sourceIds: [1] },
  });
export type OutputGenerateBody = z.infer<typeof OutputGenerateBodySchema>;

/**
 * Nested POST /v2/notebooks/:nid/outputs — path `:nid` is SSOT;
 * optional body notebookId must match when present (c69).
 */
export const OutputGenerateNestedRequestSchema = OutputGenerateBodySchema.extend({
  notebookId: IdSchema.optional(),
}).openapi({
  description: desc('output.generate_nested', '生成输出请求（nested）'),
});
export type OutputGenerateNestedRequest = z.infer<typeof OutputGenerateNestedRequestSchema>;

/** POST …/outputs/:id/convert-to-source */
export const OutputConvertToSourceResponseSchema = z
  .object({
    sourceId: IdSchema,
    filename: z.string(),
    chunkCount: z.number().int().nonnegative(),
  })
  .openapi({
    description: desc('output.convert_to_source', '输出转为来源结果'),
    example: { sourceId: 2, filename: 'faq.md', chunkCount: 1 },
  });
export type OutputConvertToSourceResponse = z.infer<typeof OutputConvertToSourceResponseSchema>;

export const OutputListSchema = z.object({
  outputs: z.array(OutputListItemSchema),
});

/**
 * Nested GET /v2/notebooks/:nid/outputs/:id/export — format only;
 * path `:nid` is notebook SSOT (c69).
 */
export const OutputExportFormatQuerySchema = z.object({
  format: z.enum(['markdown', 'json']).default('markdown'),
});
export type OutputExportFormatQuery = z.infer<typeof OutputExportFormatQuerySchema>;

/** Source row meta embedded in output/QA JSON exports. */
export const ExportSourceMetaSchema = z.object({
  sourceId: IdSchema,
  sourceName: z.string(),
  mimeType: z.string().nullable().optional(),
  parserType: z.string().nullable().optional(),
});
export type ExportSourceMeta = z.infer<typeof ExportSourceMetaSchema>;

/** JSON body for GET …/outputs/:id/export?format=json (markdown returns raw Response). */
export const OutputExportJsonResponseSchema = z
  .object({
    notebookId: IdSchema,
    outputId: IdSchema,
    outputType: OutputTypeSchema,
    prompt: z.string().nullable(),
    content: z.unknown().nullable(),
    citations: z.array(CitationSchema),
    sources: z.array(ExportSourceMetaSchema),
    exportedAt: IsoTimestampSchema,
  })
  .openapi({
    description: desc('output.export_json', '输出 JSON 导出'),
  });
export type OutputExportJsonResponse = z.infer<typeof OutputExportJsonResponseSchema>;

/** Metadata describing an output type for UI selectors (tone/prompt/isTool). */
export const OutputTypeMetaSchema = z.object({
  type: OutputTypeSchema,
  displayText: z.string(),
  description: z.string(),
  tone: z.string(),
  prompt: z.string(),
  isTool: z.boolean(),
});
export type OutputTypeMeta = z.infer<typeof OutputTypeMetaSchema>;

// ---------------------------------------------------------------------------
// Render descriptors — drive GenericOutputRenderer on the web
// ---------------------------------------------------------------------------

export const RenderLayoutSchema = z.enum([
  'list',
  'cards',
  'tree',
  'timeline',
  'sections',
  'table',
]);
export type RenderLayout = z.infer<typeof RenderLayoutSchema>;

export const RenderFieldTypeSchema = z.enum([
  'text',
  'heading',
  'badge',
  'list',
  'tree',
  'date',
  'citation',
  'code',
]);
export type RenderFieldType = z.infer<typeof RenderFieldTypeSchema>;

export type FieldDescriptor = {
  key: string;
  type: RenderFieldType;
  label: string | null;
  children?: FieldDescriptor[];
};

export const FieldDescriptorSchema: z.ZodType<FieldDescriptor> = z.lazy(() =>
  z.object({
    key: z.string(),
    type: RenderFieldTypeSchema,
    label: z.string().nullable(),
    children: z.array(FieldDescriptorSchema).optional(),
  }),
);

export const ItemSchemaSchema = z.object({
  fields: z.array(FieldDescriptorSchema),
});
export type ItemSchema = z.infer<typeof ItemSchemaSchema>;

export const RenderDescriptorSchema = z.object({
  layout: RenderLayoutSchema,
  itemSchema: ItemSchemaSchema.nullable(),
  options: z.record(z.string(), z.unknown()),
});
export type RenderDescriptor = z.infer<typeof RenderDescriptorSchema>;

export const FrontendBundleDescriptorSchema = z.object({
  apiVersion: z.literal('v1'),
  kind: z.literal('builtin'),
  id: z.string(),
  export: z.string(),
  meta: z.record(z.string(), z.unknown()).default({}),
});
export type FrontendBundleDescriptor = z.infer<typeof FrontendBundleDescriptorSchema>;

/** Full output-type meta including optional renderDescriptor (workspace/tools). */
export const OutputMetaSchema = OutputTypeMetaSchema.extend({
  renderDescriptor: RenderDescriptorSchema.nullable(),
});
export type OutputMeta = z.infer<typeof OutputMetaSchema>;
