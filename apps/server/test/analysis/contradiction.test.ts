// Tests for LLM-based contradiction detection.
import { describe, expect, it, mock } from 'bun:test';

// Mock the AI module before import
const mockGenerateText = mock(async () => ({ text: 'yes' }));

mock.module('ai', () => ({
  generateText: mockGenerateText,
  tool: () => {},
  ToolLoopAgent: class {},
}));

// Mock config to return a model
mock.module('../../src/shared/config.ts', () => ({
  getDefaultChatModel: () => ({ provider: 'openai', model: 'gpt-4' }),
}));

// Mock AI providers
mock.module('../../src/ai/providers.ts', () => ({
  resolveModel: async () => ({}),
}));

mock.module('../../src/ai/middleware.ts', () => ({
  withRetry: (m: unknown) => m,
}));

import { detectContradictions } from '../../src/features/analysis/contradiction.ts';

describe('detectContradictions', () => {
  it('returns empty for empty relations', async () => {
    const result = await detectContradictions([], new Map());
    expect(result).toEqual([]);
  });

  it('returns empty for non-similar relations', async () => {
    const result = await detectContradictions(
      [{ sourceChunkId: 1, targetChunkId: 2, relationType: 'contradicts', score: 0.9 }],
      new Map(),
    );
    expect(result).toEqual([]);
  });

  it('calls LLM for similar pairs and returns contradiction when LLM says yes', async () => {
    mockGenerateText.mockImplementation(async () => ({ text: 'yes' }));

    const chunkTexts = new Map<number, string>();
    chunkTexts.set(1, 'The sky is blue.');
    chunkTexts.set(2, 'The sky is green.');

    const result = await detectContradictions(
      [{ sourceChunkId: 1, targetChunkId: 2, relationType: 'similar', score: 0.9 }],
      chunkTexts,
      { maxChecks: 5, concurrencyLimit: 2 },
    );

    expect(result).toHaveLength(1);
    expect(result[0].relationType).toBe('contradicts');
    expect(result[0].sourceChunkId).toBe(1);
    expect(result[0].targetChunkId).toBe(2);
  });

  it('returns empty when LLM says no', async () => {
    mockGenerateText.mockImplementation(async () => ({ text: 'no' }));

    const chunkTexts = new Map<number, string>();
    chunkTexts.set(1, 'The sky is blue.');
    chunkTexts.set(2, 'The sky is blue too.');

    const result = await detectContradictions(
      [{ sourceChunkId: 1, targetChunkId: 2, relationType: 'similar', score: 0.9 }],
      chunkTexts,
    );

    expect(result).toEqual([]);
  });

  it('skips pairs with missing chunk text', async () => {
    const result = await detectContradictions(
      [{ sourceChunkId: 1, targetChunkId: 2, relationType: 'similar', score: 0.9 }],
      new Map(), // no texts
    );

    expect(result).toEqual([]);
  });

  it('respects maxChecks limit', async () => {
    const relations = Array.from({ length: 20 }, (_, i) => ({
      sourceChunkId: i,
      targetChunkId: i + 100,
      relationType: 'similar' as const,
      score: 0.8,
    }));

    const chunkTexts = new Map<number, string>();
    for (let i = 0; i < 120; i++) {
      chunkTexts.set(i, `Some text ${i}.`);
    }

    const result = await detectContradictions(relations, chunkTexts, { maxChecks: 5 });
    expect(result.length).toBeLessThanOrEqual(5);
  });
});
