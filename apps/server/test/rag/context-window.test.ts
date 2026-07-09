// Tests for the token-budgeted context window.
import { describe, expect, it } from 'bun:test';

import { buildContext, type ContextPart } from '../../src/rag/context-window.ts';

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
