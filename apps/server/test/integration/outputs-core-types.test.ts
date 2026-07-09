// Integration test: outputs generation of core structural types.
//
// Mocks the 'ai' module (generateObject) and verifies generateOutputByType
// returns the mocked structured object for FAQ and TIMELINE types.
import { describe, expect, it, mock } from 'bun:test';

// Install the AI mock BEFORE importing the module under test.
mock.module('ai', () => ({
  generateObject: async ({ prompt }: { prompt?: string }) => {
    // Distinguish by prompt content tag embedded by the test context.
    if (prompt?.includes('FAQ_CONTEXT')) {
      return {
        object: {
          items: [{ q: 'What is Crystalith?', a: 'A RAG notebook.' }],
        },
      };
    }
    if (prompt?.includes('TIMELINE_CONTEXT')) {
      return { object: { events: [{ date: '2026', event: 'v2 launch' }] } };
    }
    return { object: {} };
  },
}));

import { generateOutputByType } from '../../src/features/outputs/generator.ts';

// The model arg is unused once 'ai' is mocked — pass a sentinel.
const MOCK_MODEL = {} as never;

describe('outputs generation (integration, AI mocked)', () => {
  it('generates a FAQ from context', async () => {
    const out = (await generateOutputByType(
      MOCK_MODEL,
      'FAQ' as never,
      'FAQ_CONTEXT about Crystalith',
    )) as { items: Array<{ q: string; a: string }> };
    expect(out.items).toHaveLength(1);
    expect(out.items[0].q).toContain('Crystalith');
  });

  it('generates a TIMELINE from context', async () => {
    const out = (await generateOutputByType(
      MOCK_MODEL,
      'TIMELINE' as never,
      'TIMELINE_CONTEXT events',
    )) as { events: Array<{ date: string; event: string }> };
    expect(out.events[0].date).toBe('2026');
  });
});
