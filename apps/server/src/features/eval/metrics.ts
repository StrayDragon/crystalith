import type { LanguageModelV4 } from '@ai-sdk/provider';
// Eval metrics — LLM-as-Judge scoring for RAG quality evaluation.
//
// Computes faithfulness, relevance, and recall scores for a single QA pair.
// Uses generateObject with a structured JudgeSchema to score the answer
// against the golden expected answer and retrieved context.
import { generateObject } from 'ai';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Judge schema
// ---------------------------------------------------------------------------

const JudgeSchema = z.object({
  faithfulness: z
    .number()
    .min(0)
    .max(1)
    .describe(
      '0-1: Is the answer fully grounded in the retrieved context? 1=fully grounded, 0=hallucinated',
    ),
  relevance: z
    .number()
    .min(0)
    .max(1)
    .describe('0-1: Does the answer address the question completely? 1=perfect, 0=off-topic'),
  explanation: z.string().describe('Brief explanation of the scores'),
});

// ---------------------------------------------------------------------------
// Metrics types
// ---------------------------------------------------------------------------

export interface EvalMetrics {
  faithfulness: number;
  relevance: number;
  recall?: number;
  precision?: number;
  latencyMs: number;
  explanation?: string;
}

// ---------------------------------------------------------------------------
// Judge
// ---------------------------------------------------------------------------

/**
 * Score an answer against the golden expected answer using LLM-as-Judge.
 * Compares the generated answer against both the expected answer and the
 * retrieved context.
 */
export async function judgeAnswer(
  model: LanguageModelV4,
  question: string,
  answer: string,
  expectedAnswer: string,
  context?: string,
): Promise<EvalMetrics> {
  const contextSection = context ? `\n\nRetrieved context:\n${context.slice(0, 2000)}` : '';

  const prompt = `Question: ${question}
Expected answer: ${expectedAnswer}
Generated answer: ${answer}${contextSection}

Score the generated answer on faithfulness (grounded in context?) and relevance (addresses question?).`;

  const { object } = await generateObject({
    model,
    schema: JudgeSchema,
    system: 'You are an expert evaluator scoring RAG-generated answers. Be strict and consistent.',
    prompt,
  });

  return {
    faithfulness: object.faithfulness,
    relevance: object.relevance,
    explanation: object.explanation,
    latencyMs: 0,
  };
}

// ---------------------------------------------------------------------------
// Recall — did retrieval find expected sources?
// ---------------------------------------------------------------------------

/**
 * Compute recall@k: what fraction of expected source IDs were retrieved?
 */
export function computeRecall(retrievedSourceIds: number[], expectedSourceIds: number[]): number {
  if (expectedSourceIds.length === 0) return 1;
  const retrieved = new Set(retrievedSourceIds);
  const hit = expectedSourceIds.filter((id) => retrieved.has(id)).length;
  return hit / expectedSourceIds.length;
}

/**
 * Compute precision@k: what fraction of retrieved source IDs are relevant?
 */
export function computePrecision(
  retrievedSourceIds: number[],
  expectedSourceIds: number[],
): number {
  if (retrievedSourceIds.length === 0) return 0;
  const expected = new Set(expectedSourceIds);
  const hit = retrievedSourceIds.filter((id) => expected.has(id)).length;
  return hit / retrievedSourceIds.length;
}
