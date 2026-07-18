// Output generator — generateObject(schema) per output type.
//
// Each output type has its own Zod schema (from shared). generateObject
// is called with the schema, system prompt, and chunk context.
import type { LanguageModelV4 } from '@ai-sdk/provider';
import {
  OutputContentSchemaByType,
  type OutputMeta,
  type OutputType,
  type RenderDescriptor,
} from '@crystalith/shared';
import { generateObject } from 'ai';
import type { z } from 'zod';

export type { OutputMeta, RenderDescriptor };

// ---------------------------------------------------------------------------
// Render descriptors — tell frontend how to render each output type.
// Option keys, itemSchema, and content field keys are camelCase on the wire (c65+).
// ---------------------------------------------------------------------------

const RENDER_DESCRIPTORS: Record<string, RenderDescriptor> = {
  FAQ: {
    layout: 'cards',
    itemSchema: {
      fields: [
        { key: 'question', type: 'heading', label: '问题' },
        { key: 'answer', type: 'text', label: '回答' },
        { key: 'citations', type: 'citation', label: null },
      ],
    },
    options: { itemsKey: 'items' },
  },
  GUIDE: {
    layout: 'sections',
    itemSchema: {
      fields: [
        { key: 'title', type: 'heading', label: '模块' },
        { key: 'objective', type: 'text', label: '目标' },
        { key: 'keyPoints', type: 'list', label: '要点' },
      ],
    },
    options: { itemsKey: 'modules' },
  },
  TIMELINE: {
    layout: 'timeline',
    itemSchema: {
      fields: [
        { key: 'date', type: 'date', label: '日期' },
        { key: 'event', type: 'heading', label: '事件' },
        { key: 'description', type: 'text', label: '描述' },
        { key: 'citations', type: 'citation', label: null },
      ],
    },
    options: { itemsKey: 'events' },
  },
  MINDMAP: {
    layout: 'tree',
    itemSchema: {
      fields: [
        { key: 'label', type: 'heading', label: null },
        { key: 'citations', type: 'citation', label: null },
      ],
    },
    options: { rootKey: 'root', childrenKey: 'children', labelKey: 'label' },
  },
  QUIZ: {
    layout: 'cards',
    itemSchema: {
      fields: [
        { key: 'question', type: 'heading', label: '问题' },
        { key: 'options', type: 'list', label: '选项' },
        { key: 'answer', type: 'badge', label: '答案' },
        { key: 'explanation', type: 'text', label: '解析' },
        { key: 'citations', type: 'citation', label: null },
      ],
    },
    options: { itemsKey: 'questions' },
  },
  BRIEFING: {
    layout: 'sections',
    itemSchema: {
      fields: [
        { key: 'heading', type: 'heading', label: '章节' },
        { key: 'points', type: 'list', label: '要点' },
      ],
    },
    options: { itemsKey: 'sections' },
  },
};

export const OUTPUT_META: Record<string, OutputMeta> = {
  FAQ: {
    type: 'FAQ',
    displayText: '闪卡',
    description: '问答清单',
    tone: 'blue',
    prompt:
      'Generate a structured FAQ (Frequently Asked Questions) list based on the provided context. Each item should have a question and a detailed answer.',
    isTool: true,
    renderDescriptor: RENDER_DESCRIPTORS.FAQ,
  },
  GUIDE: {
    type: 'GUIDE',
    displayText: '指南',
    description: '学习/行动指南',
    tone: 'green',
    prompt:
      'Generate a structured learning guide based on the provided context. Organize into modules with objectives and key points.',
    isTool: true,
    renderDescriptor: RENDER_DESCRIPTORS.GUIDE,
  },
  TIMELINE: {
    type: 'TIMELINE',
    displayText: '时间线',
    description: '时间线',
    tone: 'rose',
    prompt:
      'Generate a chronological timeline based on the provided context. Each event should have a date, title, and description.',
    isTool: true,
    renderDescriptor: RENDER_DESCRIPTORS.TIMELINE,
  },
  MINDMAP: {
    type: 'MINDMAP',
    displayText: '思维导图',
    description: '思维导图',
    tone: 'indigo',
    prompt:
      'Generate a mind map structure based on the provided context. Output a hierarchical tree with a root node and nested children.',
    isTool: true,
    renderDescriptor: RENDER_DESCRIPTORS.MINDMAP,
  },
  QUIZ: {
    type: 'QUIZ',
    displayText: '测验',
    description: '测验',
    tone: 'teal',
    prompt:
      'Generate a quiz based on the provided context. Include questions with options, correct answers, and explanations.',
    isTool: true,
    renderDescriptor: RENDER_DESCRIPTORS.QUIZ,
  },
  BRIEFING: {
    type: 'BRIEFING',
    displayText: '简报',
    description: '简报',
    tone: 'amber',
    prompt:
      'Generate a briefing document based on the provided context. Organize into sections with headings and bullet points.',
    isTool: false,
    renderDescriptor: RENDER_DESCRIPTORS.BRIEFING,
  },
  SLIDES: {
    type: 'SLIDES',
    displayText: '幻灯片',
    description: '幻灯片',
    tone: 'slate',
    prompt:
      'Generate a slide deck outline based on the provided context. Include a title and slides with bullet points.',
    isTool: false,
    renderDescriptor: null,
  },
  PARAGRAPH: {
    type: 'PARAGRAPH',
    displayText: '段落',
    description: '连贯段落',
    tone: 'slate',
    prompt:
      'Generate a coherent paragraph summarizing the provided context. Write in clear, flowing prose.',
    isTool: false,
    renderDescriptor: null,
  },
  BULLETS: {
    type: 'BULLETS',
    displayText: '要点',
    description: '要点列表',
    tone: 'slate',
    prompt:
      'Generate a bullet-point summary of the provided context. Each bullet should be a concise key point.',
    isTool: false,
    renderDescriptor: null,
  },
  STRUCTURED: {
    type: 'STRUCTURED',
    displayText: '结构化',
    description: '结构化 JSON',
    tone: 'slate',
    prompt:
      'Generate structured JSON output based on the provided context. Include a title, bullet points, and term definitions.',
    isTool: false,
    renderDescriptor: null,
  },
};

export type { OutputType };

/** Alias for backward compatibility — consumers import ToolOutputType. */
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
  const fullPrompt = `Context:\n${context}\n\nGenerate a ${meta.displayText} (${meta.description}) based on the above context.`;

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
  const typeLabel = meta?.displayText ?? type;
  const typeDesc = meta?.description ?? '';

  if (prompt?.trim()) {
    return `Find context for generating a ${typeLabel} (${typeDesc}): ${prompt.trim()}`;
  }
  return `Find context for generating a ${typeLabel} (${typeDesc})`;
}
