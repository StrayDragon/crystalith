// Wave D.3 — citation sanitize + needsRepair (c50) regression tests.
import { describe, expect, it } from 'bun:test';

import {
  markPostprocessed,
  sanitizeCitationsIndices,
} from '../../src/features/outputs/citations.ts';
import { needsRepair } from '../../src/features/outputs/postprocess.ts';

describe('sanitizeCitationsIndices', () => {
  it('strips out-of-range, duplicate, and non-integer indices with warnings', () => {
    const payload = {
      items: [{ question: 'q', answer: 'a', citations: [1, 99, 1, 'x', 2.5, 2] }],
    };
    const { sanitized, changed, warnings } = sanitizeCitationsIndices(payload, 3);
    expect(changed).toBe(true);
    expect(warnings.length).toBeGreaterThan(0);
    const item = (sanitized as { items: Array<{ citations: number[] }> }).items[0]!;
    expect(item.citations).toEqual([1, 2]);
  });

  it('leaves valid unique indices unchanged', () => {
    const payload = { items: [{ citations: [1, 2] }] };
    const { changed, warnings } = sanitizeCitationsIndices(payload, 2);
    expect(changed).toBe(false);
    expect(warnings).toEqual([]);
  });
});

describe('markPostprocessed', () => {
  it('sets _postprocessed and _warnings', () => {
    const marked = markPostprocessed({ title: 't' }, true, ['w1']) as Record<string, unknown>;
    expect(marked._postprocessed).toBe(true);
    expect(marked._warnings).toEqual(['w1']);
  });
});

describe('needsRepair', () => {
  it('returns false for fallback content', () => {
    expect(needsRepair('FAQ', { _fallback: true, items: [] })).toBe(false);
  });

  it('returns true for non-object content', () => {
    expect(needsRepair('FAQ', null)).toBe(true);
    expect(needsRepair('FAQ', [])).toBe(true);
    expect(needsRepair('FAQ', 'x')).toBe(true);
  });

  it('returns true for empty FAQ items', () => {
    expect(needsRepair('FAQ', { items: [] })).toBe(true);
  });

  it('returns true for blank FAQ question/answer', () => {
    expect(needsRepair('FAQ', { items: [{ question: '', answer: 'a' }] })).toBe(true);
  });

  it('returns false for complete FAQ', () => {
    expect(needsRepair('FAQ', { items: [{ question: 'q', answer: 'a' }] })).toBe(false);
  });

  it('returns true for blank BULLETS text', () => {
    expect(needsRepair('BULLETS', { items: [{ text: '' }] })).toBe(true);
  });

  it('returns false for complete BULLETS', () => {
    expect(needsRepair('BULLETS', { items: [{ text: 'point' }] })).toBe(false);
  });

  it('returns true for empty TIMELINE/QUIZ/GUIDE/BRIEFING/MINDMAP', () => {
    expect(needsRepair('TIMELINE', { events: [] })).toBe(true);
    expect(needsRepair('QUIZ', { questions: [] })).toBe(true);
    expect(needsRepair('GUIDE', { modules: [] })).toBe(true);
    expect(needsRepair('BRIEFING', { sections: [] })).toBe(true);
    expect(needsRepair('MINDMAP', {})).toBe(true);
  });

  it('returns false for complete TIMELINE/QUIZ/GUIDE/BRIEFING/MINDMAP', () => {
    expect(needsRepair('TIMELINE', { events: [{ date: '1', event: 'e' }] })).toBe(false);
    expect(needsRepair('QUIZ', { questions: [{ question: 'q' }] })).toBe(false);
    expect(needsRepair('GUIDE', { modules: [{ title: 'm' }] })).toBe(false);
    expect(needsRepair('BRIEFING', { sections: [{ heading: 'h' }] })).toBe(false);
    expect(needsRepair('MINDMAP', { root: { label: 'r' } })).toBe(false);
  });

  it('returns true for empty PARAGRAPH text', () => {
    expect(needsRepair('PARAGRAPH', { text: '   ' })).toBe(true);
  });

  it('returns false for unknown output types', () => {
    expect(needsRepair('SLIDES', { anything: true })).toBe(false);
  });
});
