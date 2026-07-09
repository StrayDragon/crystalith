// Output generator — generateObject(schema) per output type.
//
// Each output type has its own Zod schema (from shared). generateObject
// is called with the schema, system prompt, and chunk context.
import type { LanguageModelV4 } from '@ai-sdk/provider';
import { OutputContentSchemaByType, type OutputType } from '@crystalith/shared';
import { generateObject } from 'ai';
import type { z } from 'zod';

/**
 * Metadata for each output type — maps to v1 OutputTypeMeta.
 */
export interface OutputMeta {
  type: OutputType;
  display_text: string;
  description: string;
  tone: string;
  prompt: string;
  is_tool: boolean;
}

export const OUTPUT_META: Record<string, OutputMeta> = {
  FAQ: {
    type: 'FAQ',
    display_text: '闪卡',
    description: '问答清单',
    tone: 'blue',
    prompt:
      'Generate a structured FAQ (Frequently Asked Questions) list based on the provided context. Each item should have a question and a detailed answer.',
    is_tool: true,
  },
  GUIDE: {
    type: 'GUIDE',
    display_text: '指南',
    description: '学习/行动指南',
    tone: 'green',
    prompt:
      'Generate a structured learning guide based on the provided context. Organize into modules with objectives and key points.',
    is_tool: true,
  },
  TIMELINE: {
    type: 'TIMELINE',
    display_text: '时间线',
    description: '时间线',
    tone: 'orange',
    prompt:
      'Generate a chronological timeline based on the provided context. Each event should have a date, title, and description.',
    is_tool: true,
  },
  MINDMAP: {
    type: 'MINDMAP',
    display_text: '思维导图',
    description: '思维导图',
    tone: 'grape',
    prompt:
      'Generate a mind map structure based on the provided context. Output a hierarchical tree with a root node and nested children.',
    is_tool: true,
  },
  QUIZ: {
    type: 'QUIZ',
    display_text: '测验',
    description: '测验',
    tone: 'violet',
    prompt:
      'Generate a quiz based on the provided context. Include questions with options, correct answers, and explanations.',
    is_tool: true,
  },
  BRIEFING: {
    type: 'BRIEFING',
    display_text: '简报',
    description: '简报',
    tone: 'teal',
    prompt:
      'Generate a briefing document based on the provided context. Organize into sections with headings and bullet points.',
    is_tool: false,
  },
  SLIDES: {
    type: 'SLIDES',
    display_text: '幻灯片',
    description: '幻灯片',
    tone: 'red',
    prompt:
      'Generate a slide deck outline based on the provided context. Include a title and slides with bullet points.',
    is_tool: false,
  },
  PARAGRAPH: {
    type: 'PARAGRAPH',
    display_text: '段落',
    description: '连贯段落',
    tone: 'blue',
    prompt:
      'Generate a coherent paragraph summarizing the provided context. Write in clear, flowing prose.',
    is_tool: false,
  },
  BULLETS: {
    type: 'BULLETS',
    display_text: '要点',
    description: '要点列表',
    tone: 'green',
    prompt:
      'Generate a bullet-point summary of the provided context. Each bullet should be a concise key point.',
    is_tool: false,
  },
  STRUCTURED: {
    type: 'STRUCTURED',
    display_text: '结构化',
    description: '结构化 JSON',
    tone: 'orange',
    prompt:
      'Generate structured JSON output based on the provided context. Include a title, bullet points, and term definitions.',
    is_tool: false,
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
