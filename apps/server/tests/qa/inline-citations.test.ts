// generation-core r171 — QA inline citation backfill.
// ensureInlineCitations appends a [1] fallback marker only when the answer
// carries no bracket citation at all and citations exist; the no-evidence
// path (empty citations) must never inject a marker.
//
// Pure-function unit test — no DB, no AI mock needed (handler.ts has no
// import-time side effects beyond module loading).
import { describe, expect, it } from 'bun:test';

import type { Citation } from '@crystalith/shared';

import { ensureInlineCitations } from '../../src/features/qa/handler.ts';

const CITATIONS: Citation[] = [
  {
    sourceId: 1,
    sourceName: 'a.md',
    chunkId: 11,
    chunkIndex: 1,
    pageNumber: null,
    paragraphIndex: null,
    snippet: '证据片段',
    score: 0.9,
  },
];

describe('r171 inline citation backfill', () => {
  it('appends [1] when evidence exists but the answer has no [N] citation', () => {
    // covers: r171
    expect(ensureInlineCitations('纯文本回答', CITATIONS)).toBe('纯文本回答 [1]');
  });

  it('keeps the answer untouched when it already carries inline citations', () => {
    // covers: r171
    expect(ensureInlineCitations('答案见 [1] 与 [2]。', CITATIONS)).toBe('答案见 [1] 与 [2]。');
  });

  it('never injects a marker on the no-evidence path (empty citations)', () => {
    // covers: r171
    expect(ensureInlineCitations('纯文本回答', [])).toBe('纯文本回答');
  });
});
