// @crystalith/shared — QA pipeline schemas.
//
// ContextStats: token-budget accounting for the retrieval context window.
// Field names align with v1 (crystalith.shared.schemas.qa.ContextStats);
// c54 moved this type out of apps/server/src/features/qa/retrieve-and-judge.ts
// into the shared SSOT so the frontend can consume the same contract.
import { z } from 'zod';

/**
 * Token-budget statistics for a QA retrieval context window.
 *
 * `compressed` is true when the assembled context exceeded the token budget
 * and was truncated/compressed to fit (c55 wires the actual truncation).
 * Matches v1 field names: total_tokens / system_tokens / history_tokens /
 * retrieval_tokens / query_tokens / max_tokens / compressed.
 */
export const ContextStatsSchema = z.object({
  totalTokens: z.number().int().nonnegative(),
  systemTokens: z.number().int().nonnegative(),
  historyTokens: z.number().int().nonnegative(),
  retrievalTokens: z.number().int().nonnegative(),
  queryTokens: z.number().int().nonnegative(),
  maxTokens: z.number().int().nonnegative(),
  compressed: z.boolean(),
});
export type ContextStats = z.infer<typeof ContextStatsSchema>;
