import type { LanguageModelV4 } from '@ai-sdk/provider';
import {
  OutputContentSchemaByType,
  type ToolOutputType,
  type ModelConfig,
} from '@crystalith/shared';
// Structured output generation — generateText + Output.object wrapper that
// dispatches on the shared output-type Zod schemas.
//
// Each of the 7 "tool" output types (FAQ, GUIDE, TIMELINE, MINDMAP, QUIZ,
// BRIEFING, SLIDES) has a dedicated Zod content schema in
// @crystalith/shared. `generateOutput` resolves the model, calls
// `generateText` with `Output.object`, and returns the validated object.
import { generateText, Output, isStepCount } from 'ai';
import { z } from 'zod';

import { getModelById, getDefaultChatModel, getCompletionOptions } from '../shared/config.ts';
import { withRetry } from './middleware.ts';
import { resolveModel } from './providers.ts';

export interface GenerateOutputOptions {
  type: ToolOutputType;
  prompt: string;
  /** System prompt describing the generation task. */
  systemPrompt?: string;
  /** Override the default chat model. */
  modelId?: string;
  /** Pre-resolved model (skip registry lookup — for tests). */
  model?: LanguageModelV4;
  /** RAG context chunks to inject into the prompt. */
  context?: string;
  /** Max generation tokens. */
  maxTokens?: number;
  /** Sampling temperature. */
  temperature?: number;
}

export interface GenerateOutputResult<T extends ToolOutputType> {
  type: T;
  content: z.infer<(typeof OutputContentSchemaByType)[T]>;
  /** Token usage reported by the provider. */
  usage?: { promptTokens: number; completionTokens: number };
}

/** Generate a structured output of the given type. */
export async function generateOutput<T extends ToolOutputType>(
  opts: GenerateOutputOptions & { type: T },
): Promise<GenerateOutputResult<T>> {
  // ZodType erase: AI SDK Output.object cannot take the ToolOutputType schema union.
  const schema: z.ZodTypeAny = OutputContentSchemaByType[opts.type];

  const model = opts.model ?? (await resolveModelFromConfig(opts.modelId));
  const wrapped = withRetry(model);

  const systemPrompt = opts.systemPrompt ?? defaultSystemPrompt(opts.type, opts.context);
  const co = getCompletionOptions();

  const result = await generateText({
    model: wrapped,
    output: Output.object({ schema }),
    instructions: systemPrompt,
    prompt: opts.prompt,
    ...(opts.maxTokens !== undefined ? { maxOutputTokens: opts.maxTokens } : {}),
    temperature: opts.temperature ?? co.temperature,
    ...(co.top_p !== undefined ? { topP: co.top_p } : {}),
    ...(co.top_k !== undefined ? { topK: co.top_k } : {}),
    ...(co.stop !== undefined ? { stopSequences: co.stop } : {}),
  });

  if (result.output === null || result.output === undefined) {
    throw new Error(`No structured ${opts.type} output generated`);
  }

  // Re-validate with the concrete mapped schema; generic T correlation still needs a cast.
  const parsed = OutputContentSchemaByType[opts.type].safeParse(result.output);
  if (!parsed.success) {
    throw new Error(`Invalid structured ${opts.type} output generated`);
  }

  return {
    type: opts.type,
    content: parsed.data as unknown as GenerateOutputResult<T>['content'],
    usage: result.usage
      ? {
          promptTokens: result.usage.inputTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? 0,
        }
      : undefined,
  };
}

/** Resolve a ModelConfig by id (or fall back to the default chat model). */
async function resolveModelFromConfig(modelId?: string): Promise<LanguageModelV4> {
  const cfg: ModelConfig | undefined = modelId ? getModelById(modelId) : getDefaultChatModel();
  if (!cfg) {
    throw new Error(
      modelId ? `Model '${modelId}' not found in config` : 'No default chat model configured',
    );
  }
  return resolveModel(cfg);
}

/** Default system prompt for each output type. */
function defaultSystemPrompt(type: ToolOutputType, context?: string): string {
  const base = `You are a knowledge synthesis assistant. Generate a ${type} output from the provided source material. Follow the schema exactly.`;
  if (context) {
    return `${base}\n\nSource material:\n${context}`;
  }
  return base;
}

// Re-export for consumers that need the step-count stop condition.
export { isStepCount };
