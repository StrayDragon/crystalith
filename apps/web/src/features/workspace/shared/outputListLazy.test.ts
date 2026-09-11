import { describe, expect, it } from '@rstest/core';

import type { OutputItem } from './types';
import { mergeOutputListWithCache, normalizeOutput } from './utils';

describe('c72 output list merge / normalize', () => {
  it('normalizes list rows without content as unloaded', () => {
    const item = normalizeOutput({
      id: 1,
      notebookId: 9,
      type: 'FAQ',
      prompt: 'p',
      title: 'List Title',
      preview: 'prev…',
      chunkIds: [1],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as never);

    expect(item.contentLoaded).toBe(false);
    expect(item.content).toBeNull();
    expect(item.title).toBe('List Title');
  });

  it('preserves cached detail when list refresh omits content', () => {
    const cached: OutputItem = {
      id: 1,
      type: 'FAQ',
      prompt: 'p',
      chunkIds: [1],
      content: { items: [{ question: 'Q', answer: 'A' }] } as never,
      contentLoaded: true,
      title: 'Old',
      createdAt: 'a',
      updatedAt: 'b',
    };

    const merged = mergeOutputListWithCache(
      [
        {
          id: 1,
          notebookId: 9,
          type: 'FAQ',
          prompt: 'p',
          title: 'New Title',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        } as never,
      ],
      [cached],
    );

    expect(merged[0].contentLoaded).toBe(true);
    expect(merged[0].content).toEqual(cached.content);
    expect(merged[0].title).toBe('New Title');
  });
});
