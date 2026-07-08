import { describe, expect, it } from 'vitest';

import {
  decodeOutputItem,
  getOutputPayloadWarnings,
  getOutputTitle,
  getSlideIdFromOutput,
  isFallbackOutputPayload,
  normalizeOutputPayload,
} from './outputPayload';
import type { OutputItem } from './types';

function createOutput(partial: Partial<OutputItem>): OutputItem {
  return {
    id: 1,
    type: 'FAQ',
    prompt: 'default prompt',
    chunkIds: [1],
    content: {},
    createdAt: '2026-01-01 10:00',
    updatedAt: '2026-01-01 10:00',
    ...partial,
  };
}

describe('outputPayload decoder', () => {
  it('narrows FAQ payloads to typed output', () => {
    const output = createOutput({
      type: 'FAQ',
      content: { items: [{ question: 'Q1', answer: 'A1' }] },
    });

    const decoded = decodeOutputItem(output);
    expect(decoded?.type).toBe('FAQ');
    expect(decoded).not.toBeNull();
    if (decoded?.type !== 'FAQ') {
      throw new Error('Expected FAQ output');
    }
    expect(decoded.content.items[0]?.question).toBe('Q1');
  });

  it('returns null for invalid typed payloads', () => {
    const output = createOutput({
      type: 'QUIZ',
      content: { items: [] },
    });

    const decoded = decodeOutputItem(output);
    expect(decoded).toBeNull();
  });

  it('normalizes invalid payload to fallback structure', () => {
    const payload = normalizeOutputPayload('GUIDE', { nope: true });
    expect(isFallbackOutputPayload(payload)).toBe(true);
    expect(getOutputPayloadWarnings(payload)).toContain('Invalid payload for GUIDE');
  });

  it('extracts slide id from typed slides payload', () => {
    const output = createOutput({
      type: 'SLIDES',
      content: { slide_id: 99, title: 'Deck' },
    });

    expect(getSlideIdFromOutput(output)).toBe(99);
  });

  it('resolves title by content title then prompt then default', () => {
    const fromContent = createOutput({
      type: 'BRIEFING',
      prompt: 'Prompt title',
      content: { title: 'Content title', sections: [] },
    });
    expect(getOutputTitle(fromContent)).toBe('Content title');

    const fromPrompt = createOutput({
      type: 'BRIEFING',
      prompt: 'Prompt title',
      content: { sections: [] },
    });
    expect(getOutputTitle(fromPrompt)).toBe('Prompt title');

    const fallback = createOutput({
      type: 'BRIEFING',
      prompt: '   ',
      content: { sections: [] },
    });
    expect(getOutputTitle(fallback)).toBe('BRIEFING 输出');
  });
});
