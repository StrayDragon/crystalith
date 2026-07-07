// Structured output generation — generateObject wrapper that dispatches on
// the shared output-type Zod schemas.
//
// Each of the 7 "tool" output types (FAQ, GUIDE, TIMELINE, MINDMAP, QUIZ,
// BRIEFING, SLIDES) has a dedicated Zod content schema in
// @crystalith/shared. `generateOutput` resolves the model, calls
// `generateObject` with the right schema, and returns the validated object.
import { generateObject, isStepCount } from "ai";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { z } from "zod";

import {
  OutputContentSchemaByType,
  type ToolOutputType,
  type ModelConfig,
} from "@crystalith/shared";

import { resolveModel } from "./providers.ts";
import { withRetry } from "./middleware.ts";
import { getModelById, getDefaultChatModel } from "../shared/config.ts";

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
  const schema = OutputContentSchemaByType[opts.type] as z.ZodTypeAny;

  const model = opts.model ?? (await resolveModelFromConfig(opts.modelId));
  const wrapped = withRetry(model, { maxRetries: 2 });

  const systemPrompt = opts.systemPrompt ?? defaultSystemPrompt(opts.type, opts.context);

  const result = await generateObject({
    model: wrapped,
    schema,
    system: systemPrompt,
    prompt: opts.prompt,
    ...(opts.maxTokens !== undefined ? { maxOutputTokens: opts.maxTokens } : {}),
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  });

  return {
    type: opts.type,
    content: result.object as GenerateOutputResult<T>["content"],
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
      modelId ? `Model '${modelId}' not found in config` : "No default chat model configured",
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
