// Output generator — generateObject(schema) per output type.
//
// Each output type has its own Zod schema (from shared). generateObject
// is called with the schema, system prompt, and chunk context.
import type { LanguageModelV4 } from '@ai-sdk/provider';
import { OutputContentSchemaByType, type OutputType, type StudioTone } from '@crystalith/shared';
import { generateObject } from 'ai';
import type { z } from 'zod';

/**
 * Render field descriptor (v1 FieldDescriptor) — tells frontend how to render
 * a field within an output item. mirrors apps/web/src/.../types.ts FieldDescriptor.
 */
export interface FieldDescriptor {
  key: string;
  type: 'heading' | 'text' | 'list' | 'badge' | 'date' | 'tree' | 'citation' | 'code';
  label: string | null;
}

/**
 * Render descriptor (v1 RenderDescriptor) — tells frontend GenericOutputRenderer
 * how to display a structured output type as visual cards/tree/sections/etc.
 */
export interface RenderDescriptor {
  layout: 'cards' | 'list' | 'sections' | 'timeline' | 'table' | 'tree';
  item_schema: { fields: FieldDescriptor[] } | null;
  options: Record<string, unknown>;
}

/**
 * Metadata for each output type — maps to v1 OutputTypeMeta.
 */
export interface OutputMeta {
  type: OutputType;
  display_text: string;
  description: string;
  tone: StudioTone;
  prompt: string;
  is_tool: boolean;
  /**
   * Render descriptor for frontend GenericOutputRenderer.
   * When provided, the frontend renders output content as structured visual
   * elements instead of raw JSON. Mirrors v1 plugin.render_descriptor.
   */
  render_descriptor: RenderDescriptor | null;
}

// ---------------------------------------------------------------------------
// Render descriptors (v1 plugins' render_descriptor) — tell frontend how to
// render each output type as structured visual elements instead of raw JSON.
// SSOT: backend/py/plugins/crystalith-output-{faq,guide,mindmap,timeline,quiz,briefing}/.../plugin.py
// ---------------------------------------------------------------------------

const RENDER_DESCRIPTORS: Record<string, RenderDescriptor> = {
  FAQ: {
    layout: 'cards',
    item_schema: {
      fields: [
        { key: 'question', type: 'heading', label: '问题' },
        { key: 'answer', type: 'text', label: '回答' },
        { key: 'citations', type: 'citation', label: null },
      ],
    },
    options: { items_key: 'items' },
  },
  GUIDE: {
    layout: 'sections',
    item_schema: {
      fields: [
        { key: 'title', type: 'heading', label: '模块' },
        { key: 'objective', type: 'text', label: '目标' },
        { key: 'key_points', type: 'list', label: '要点' },
      ],
    },
    options: { items_key: 'modules' },
  },
  TIMELINE: {
    layout: 'timeline',
    item_schema: {
      fields: [
        { key: 'date', type: 'date', label: '日期' },
        { key: 'event', type: 'heading', label: '事件' },
        { key: 'description', type: 'text', label: '描述' },
        { key: 'citations', type: 'citation', label: null },
      ],
    },
    options: { items_key: 'events' },
  },
  MINDMAP: {
    layout: 'tree',
    item_schema: {
      fields: [
        { key: 'label', type: 'heading', label: null },
        { key: 'citations', type: 'citation', label: null },
      ],
    },
    options: { root_key: 'root', children_key: 'children', label_key: 'label' },
  },
  QUIZ: {
    layout: 'cards',
    item_schema: {
      fields: [
        { key: 'question', type: 'heading', label: '问题' },
        { key: 'options', type: 'list', label: '选项' },
        { key: 'answer', type: 'badge', label: '答案' },
        { key: 'explanation', type: 'text', label: '解析' },
        { key: 'citations', type: 'citation', label: null },
      ],
    },
    options: { items_key: 'questions' },
  },
  BRIEFING: {
    layout: 'sections',
    item_schema: {
      fields: [
        { key: 'heading', type: 'heading', label: '章节' },
        { key: 'points', type: 'list', label: '要点' },
      ],
    },
    options: { items_key: 'sections' },
  },
};

export const OUTPUT_META: Record<string, OutputMeta> = {
  FAQ: {
    type: 'FAQ',
    display_text: '闪卡',
    description: '问答清单',
    tone: 'blue',
    prompt:
      'Generate a structured FAQ (Frequently Asked Questions) list based on the provided context. Each item should have a question and a detailed answer.',
    is_tool: true,
    render_descriptor: RENDER_DESCRIPTORS.FAQ,
  },
  GUIDE: {
    type: 'GUIDE',
    display_text: '指南',
    description: '学习/行动指南',
    tone: 'green',
    prompt:
      'Generate a structured learning guide based on the provided context. Organize into modules with objectives and key points.',
    is_tool: true,
    render_descriptor: RENDER_DESCRIPTORS.GUIDE,
  },
  TIMELINE: {
    type: 'TIMELINE',
    display_text: '时间线',
    description: '时间线',
    tone: 'rose',
    prompt:
      'Generate a chronological timeline based on the provided context. Each event should have a date, title, and description.',
    is_tool: true,
    render_descriptor: RENDER_DESCRIPTORS.TIMELINE,
  },
  MINDMAP: {
    type: 'MINDMAP',
    display_text: '思维导图',
    description: '思维导图',
    tone: 'indigo',
    prompt:
      'Generate a mind map structure based on the provided context. Output a hierarchical tree with a root node and nested children.',
    is_tool: true,
    render_descriptor: RENDER_DESCRIPTORS.MINDMAP,
  },
  QUIZ: {
    type: 'QUIZ',
    display_text: '测验',
    description: '测验',
    tone: 'teal',
    prompt:
      'Generate a quiz based on the provided context. Include questions with options, correct answers, and explanations.',
    is_tool: true,
    render_descriptor: RENDER_DESCRIPTORS.QUIZ,
  },
  BRIEFING: {
    type: 'BRIEFING',
    display_text: '简报',
    description: '简报',
    tone: 'amber',
    prompt:
      'Generate a briefing document based on the provided context. Organize into sections with headings and bullet points.',
    is_tool: false,
    render_descriptor: RENDER_DESCRIPTORS.BRIEFING,
  },
  SLIDES: {
    type: 'SLIDES',
    display_text: '幻灯片',
    description: '幻灯片',
    tone: 'slate',
    prompt:
      'Generate a slide deck outline based on the provided context. Include a title and slides with bullet points.',
    is_tool: false,
    render_descriptor: null,
  },
  PARAGRAPH: {
    type: 'PARAGRAPH',
    display_text: '段落',
    description: '连贯段落',
    tone: 'slate',
    prompt:
      'Generate a coherent paragraph summarizing the provided context. Write in clear, flowing prose.',
    is_tool: false,
    render_descriptor: null,
  },
  BULLETS: {
    type: 'BULLETS',
    display_text: '要点',
    description: '要点列表',
    tone: 'slate',
    prompt:
      'Generate a bullet-point summary of the provided context. Each bullet should be a concise key point.',
    is_tool: false,
    render_descriptor: null,
  },
  STRUCTURED: {
    type: 'STRUCTURED',
    display_text: '结构化',
    description: '结构化 JSON',
    tone: 'slate',
    prompt:
      'Generate structured JSON output based on the provided context. Include a title, bullet points, and term definitions.',
    is_tool: false,
    render_descriptor: null,
  },
};

export type { OutputType };

// Alias for backward compatibility — consumers import ToolOutputType.
export type ToolOutputType = OutputType;

/**
 * Generate a structured output object of a specific type.
 * Returns the parsed object matching the Zod schema for that type.
 */
export async function generateOutputByType(
  model: LanguageModelV4,
  type: OutputType,
  context: string,
  customPrompt?: string,
): Promise<unknown> {
  const schema = OutputContentSchemaByType[type] as z.ZodObject<z.ZodRawShape>;
  const meta = OUTPUT_META[type];
  if (!meta) throw new Error(`Unknown output type: ${type}`);

  const systemPrompt = customPrompt || meta.prompt;
  const fullPrompt = `Context:\n${context}\n\nGenerate a ${meta.display_text} (${meta.description}) based on the above context.`;

  const { object } = await generateObject({
    model,
    schema,
    system: systemPrompt,
    prompt: fullPrompt,
  });

  return object;
}

/** List available output type metadata. */
export function listOutputTypes(): OutputMeta[] {
  return Object.values(OUTPUT_META);
}

/**
 * Build a retrieval query from output type + optional prompt (c27).
 *
 * Constructs a natural-language search query tuned for the output type
 * so vector search retrieves the most relevant chunks. Falls back to the
 * meta description when no prompt is provided.
 */
export function buildOutputQuery(type: OutputType, prompt?: string): string {
  const meta = OUTPUT_META[type];
  const typeLabel = meta?.display_text ?? type;
  const typeDesc = meta?.description ?? '';

  if (prompt?.trim()) {
    return `Find context for generating a ${typeLabel} (${typeDesc}): ${prompt.trim()}`;
  }
  return `Find context for generating a ${typeLabel} (${typeDesc})`;
}
