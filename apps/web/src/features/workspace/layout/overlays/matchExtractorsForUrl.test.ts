import type { ExtractorInfo } from '@crystalith/shared';
import { describe, expect, it } from 'vitest';

import { matchExtractorsForUrl, pickSelectedExtractor } from './matchExtractorsForUrl';

function extractor(overrides: Partial<ExtractorInfo> & Pick<ExtractorInfo, 'type'>): ExtractorInfo {
  return {
    type: overrides.type,
    enabled: overrides.enabled ?? true,
    available: overrides.available ?? true,
    displayName: overrides.displayName ?? overrides.type,
    description: overrides.description ?? '',
    priority: overrides.priority ?? 10,
    requiresApiKey: overrides.requiresApiKey ?? false,
    requiresService: overrides.requiresService ?? false,
    urlPatterns: overrides.urlPatterns ?? null,
  };
}

describe('matchExtractorsForUrl', () => {
  const arxiv = extractor({
    type: 'arxiv',
    displayName: 'arXiv',
    priority: 5,
    urlPatterns: [
      '^https?:\\/\\/(?:www\\.|export\\.)?arxiv\\.org\\/abs\\/',
      '^https?:\\/\\/(?:www\\.|export\\.)?arxiv\\.org\\/pdf\\/',
    ],
  });
  const readability = extractor({
    type: 'readability',
    displayName: 'Readability',
    priority: 20,
    urlPatterns: null,
  });
  const disabled = extractor({
    type: 'jina',
    displayName: 'Jina',
    priority: 15,
    enabled: false,
    urlPatterns: ['example\\.com'],
  });

  it('returns arxiv for abs URLs', () => {
    const matches = matchExtractorsForUrl('https://arxiv.org/abs/1706.03762', [
      readability,
      arxiv,
      disabled,
    ]);
    expect(matches.map((entry) => entry.type)).toEqual(['arxiv']);
  });

  it('returns arxiv for pdf URLs', () => {
    const matches = matchExtractorsForUrl('https://arxiv.org/pdf/1706.03762', [readability, arxiv]);
    expect(matches.map((entry) => entry.type)).toEqual(['arxiv']);
  });

  it('ignores disabled/unavailable and invalid patterns', () => {
    const badPattern = extractor({
      type: 'firecrawl',
      priority: 30,
      urlPatterns: ['(?'],
    });
    expect(
      matchExtractorsForUrl('https://example.com', [disabled, badPattern, readability]),
    ).toEqual([]);
  });

  it('sorts matches by priority ascending', () => {
    const high = extractor({
      type: 'a',
      priority: 1,
      urlPatterns: ['example'],
    });
    const low = extractor({
      type: 'b',
      priority: 50,
      urlPatterns: ['example'],
    });
    expect(matchExtractorsForUrl('https://example.com/x', [low, high]).map((e) => e.type)).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('pickSelectedExtractor', () => {
  const matches = [
    extractor({ type: 'arxiv', priority: 5 }),
    extractor({ type: 'other', priority: 20 }),
  ];

  it('returns undefined when nothing selected', () => {
    expect(pickSelectedExtractor(matches, new Set())).toBeUndefined();
  });

  it('returns highest-priority selected match', () => {
    expect(pickSelectedExtractor(matches, new Set(['arxiv', 'other']))).toBe('arxiv');
  });
});
