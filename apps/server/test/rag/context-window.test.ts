// Tests for the token-budgeted context window.
import { describe, expect, it } from 'bun:test';

import {
  buildContext,
  truncateToTokenBudget,
  type ContextPart,
} from '../../src/rag/context-window.ts';

// Each "token" ≈ 4 chars for English text via the fallback estimator, so we
// use generous text to exceed small budgets.
describe('buildContext', () => {
  it('passes through when under budget', () => {
    const parts: ContextPart[] = [{ role: 'system', text: 'You are helpful.' }];
    const out = buildContext(parts, 1000);
    expect(out).toContain('You are helpful.');
  });

  it('numbers retrieval blocks as [i]', () => {
    const parts: ContextPart[] = [
      { role: 'retrieval', text: 'first chunk' },
      { role: 'retrieval', text: 'second chunk' },
    ];
    const out = buildContext(parts, 10000);
    expect(out).toContain('[1] first chunk');
    expect(out).toContain('[2] second chunk');
  });

  it('truncates history before system/query when over budget', () => {
    const longHistory = 'H'.repeat(5000);
    const parts: ContextPart[] = [
      { role: 'history', text: longHistory },
      { role: 'system', text: 'keep me' },
      { role: 'query', text: 'keep me too' },
    ];
    const out = buildContext(parts, 100); // tiny budget
    expect(out).toContain('keep me');
    expect(out).toContain('keep me too');
    // history should be truncated (much shorter than 5000 chars)
    expect(out.length).toBeLessThan(longHistory.length);
  });

  it('never truncates system or query', () => {
    const sys = 'S'.repeat(2000);
    const q = 'Q'.repeat(2000);
    const parts: ContextPart[] = [
      { role: 'history', text: 'x'.repeat(100) },
      { role: 'system', text: sys },
      { role: 'query', text: q },
    ];
    const out = buildContext(parts, 50);
    expect(out).toContain(sys);
    expect(out).toContain(q);
  });
});

// c55: truncateToTokenBudget — block-level truncation (v1 _truncate_blocks port).
describe('truncateToTokenBudget', () => {
  it('passes blocks through unchanged when under budget', () => {
    const blocks = ['alpha block', 'beta block'];
    const { text, truncated, usedTokens } = truncateToTokenBudget(blocks, 10000);
    expect(truncated).toBe(false);
    expect(text).toBe('alpha block\n\nbeta block');
    expect(usedTokens).toBeGreaterThan(0);
  });

  it('returns empty + truncated when budget is ≤ 0', () => {
    const { text, truncated, usedTokens } = truncateToTokenBudget(['x'], 0);
    expect(text).toBe('');
    expect(truncated).toBe(true);
    expect(usedTokens).toBe(0);
  });

  it('truncates and sets truncated=true when blocks exceed budget', () => {
    const blocks = [`${'a'.repeat(400)}`, `${'b'.repeat(400)}`, `${'c'.repeat(400)}`];
    const budget = 30; // small budget forces truncation
    const { text, truncated, usedTokens } = truncateToTokenBudget(blocks, budget);
    expect(truncated).toBe(true);
    expect(usedTokens).toBeLessThanOrEqual(budget);
    // Output is non-empty (at least the head of the first block is kept).
    expect(text.length).toBeGreaterThan(0);
  });

  it('keeps whole blocks that fit then partially trims the boundary block', () => {
    // First block small enough to fit; second block overflows and is trimmed.
    const small = 'fits';
    const large = `${'z'.repeat(800)}`;
    const budget = 20;
    const { text, truncated } = truncateToTokenBudget([small, large], budget);
    expect(truncated).toBe(true);
    expect(text).toContain(small); // first block fully kept
    // Boundary block is partially trimmed (head kept), so output has some 'z'.
    expect(text).toContain('z');
  });
});
