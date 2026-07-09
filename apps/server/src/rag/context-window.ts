// Context window — token-budgeted assembly of retrieval context.
//
// Ports v1's ContextWindow.build priority-truncation (window.py): when the
// assembled context exceeds the model's token budget, parts are truncated in
// priority order (lowest priority first) until it fits. System + query are
// always preserved; history/retrieval are trimmed first.
import { countTokens, truncateToTokens } from '../ai/tokenizer.ts';

export type ContextPartRole = 'system' | 'retrieval' | 'history' | 'recent' | 'query';

export interface ContextPart {
  role: ContextPartRole;
  text: string;
}

// Priority: higher number = more important (kept when over budget).
// system/query are never truncated; history is cheapest to drop.
const PRIORITY: Record<ContextPartRole, number> = {
  history: 1,
  retrieval: 2,
  recent: 3,
  system: 4,
  query: 4,
};

/**
 * Assemble context parts into a single string, truncating low-priority parts
 * if the total exceeds maxTokens. Numbered retrieval blocks are formatted as
 * `[i] text` (matching v1 context.py formatting).
 */
export function buildContext(parts: ContextPart[], maxTokens: number): string {
  // Sort a copy by priority asc so we trim the cheapest first.
  const ordered = [...parts].sort((a, b) => PRIORITY[a.role] - PRIORITY[b.role]);

  // Compute current total.
  let total = parts.reduce((sum, p) => sum + countTokens(p.text), 0);

  // Truncate from lowest priority until within budget.
  for (const part of ordered) {
    if (total <= maxTokens) break;
    if (part.role === 'system' || part.role === 'query') continue; // never trim
    const partTokens = countTokens(part.text);
    const overflow = total - maxTokens;
    const keep = Math.max(0, partTokens - overflow);
    part.text = truncateToTokens(part.text, keep);
    total -= partTokens - keep;
  }

  // Render: retrieval blocks numbered, others verbatim, joined by blank lines.
  const blocks: string[] = [];
  let retrievalIdx = 0;
  // Render in original order for readability.
  for (const part of parts) {
    if (part.role === 'retrieval') {
      retrievalIdx++;
      blocks.push(`[${retrievalIdx}] ${part.text}`);
    } else {
      blocks.push(part.text);
    }
  }
  return blocks.join('\n\n');
}
