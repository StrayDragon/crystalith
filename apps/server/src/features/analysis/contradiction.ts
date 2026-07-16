// Contradiction detection — LLM pairwise check on correlated pairs.
//
// Takes the top-N "similar" relations (by score), sends each pair to the LLM
// to determine if they contradict. Concurrency-limited to avoid overwhelming
// the model provider.

import { generateText } from 'ai';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import type { Relation } from './correlation.ts';

/**
 * Use LLM to detect contradictions among the top similar relations.
 *
 * For each candidate pair (up to maxChecks), sends both excerpts to the LLM
 * with a yes/no instruction. Pairs determined to contradict are returned
 * with type="contradicts".
 *
 * @param relations — pre-computed "similar" relations (from detectRelations)
 * @param chunkTexts — map of chunkId → text for resolving excerpts
 * @param options.maxChecks — limit number of LLM calls (default 12)
 * @param options.concurrencyLimit — parallel LLM calls (default 5)
 */
export async function detectContradictions(
  relations: Relation[],
  chunkTexts: Map<number, string>,
  options: { maxChecks?: number; concurrencyLimit?: number } = {},
): Promise<Relation[]> {
  const { maxChecks = 12, concurrencyLimit = 5 } = options;
  if (maxChecks <= 0 || relations.length === 0) return [];

  // Only check "similar" relations, sorted by highest score.
  const candidates = relations
    .filter((r) => r.relationType === 'similar')
    .toSorted((a, b) => b.score - a.score)
    .slice(0, maxChecks);

  if (candidates.length === 0) return [];

  const results: Relation[] = [];
  const errors: Array<{ chunkId: number; error: string }> = [];

  // Process with concurrency limit using simple batch slicing.
  for (let i = 0; i < candidates.length; i += concurrencyLimit) {
    const batch = candidates.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.allSettled(
      batch.map(async (rel) => {
        const leftText = truncate(chunkTexts.get(rel.sourceChunkId) ?? '');
        const rightText = truncate(chunkTexts.get(rel.targetChunkId) ?? '');
        if (!leftText || !rightText) return null;

        const contradict = await checkContradiction(leftText, rightText);
        if (contradict) {
          return {
            sourceChunkId: rel.sourceChunkId,
            targetChunkId: rel.targetChunkId,
            relationType: 'contradicts' as const,
            score: rel.score,
          };
        }
        return null;
      }),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      } else if (result.status === 'rejected') {
        errors.push({ chunkId: 0, error: result.reason?.message ?? 'Unknown' });
      }
    }
  }

  if (errors.length > 0) {
    console.warn(`[contradiction] ${errors.length} LLM checks failed:`, errors[0].error);
  }

  return results;
}

/** Truncate text to ~800 chars for LLM context window. */
function truncate(text: string, limit = 800): string {
  const cleaned = text.replaceAll(/\s+/gu, ' ').trim();
  if (cleaned.length <= limit) return cleaned;
  return cleaned.slice(0, limit) + '...';
}

/**
 * Single LLM call: check if two excerpts contradict each other.
 * Returns true if they contradict, false otherwise.
 */
async function checkContradiction(left: string, right: string): Promise<boolean> {
  const modelConfig = getDefaultChatModel();
  if (!modelConfig) throw new Error('No chat model configured');
  const model = withRetry(await resolveModel(modelConfig));

  const result = await generateText({
    model,
    system:
      'You compare two excerpts from different sources. Determine if they contradict each other. Respond with "yes" or "no" only.',
    prompt: `Excerpt A:\n${left}\n\nExcerpt B:\n${right}\n\nDo these excerpts contradict each other?`,
  });

  const response = result.text.trim().toLowerCase();
  // v1 contradiction.py:18-26: yes/true → True, no/false → False,
  // fallback: "contradict" in text and "not" not in text → True
  if (response.startsWith('yes') || response === 'true') return true;
  if (response.startsWith('no') || response === 'false') return false;
  // Ambiguous wording fallback (v1 _is_contradiction)
  return response.includes('contradict') && !response.includes('not contradict');
}
