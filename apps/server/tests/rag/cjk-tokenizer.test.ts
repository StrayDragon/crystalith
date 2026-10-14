// c132 T1 (r487): CJK tokenizer pure-function contract — bigram CJK runs,
// lowercased latin word runs, safe quoted MATCH output.
import { describe, expect, it } from 'bun:test';

import { buildMatchQuery, tokenize, tokenizeForIndex } from '../../src/rag/cjk-tokenizer.ts';

describe('tokenize', () => {
  it('bigrams CJK runs', () => {
    expect(tokenize('向量数据库')).toEqual(['向量', '量数', '数据', '据库']);
  });

  it('keeps a two-char CJK word as one token', () => {
    expect(tokenize('向量')).toEqual(['向量']);
  });

  it('keeps a lone CJK char as a single-char token', () => {
    expect(tokenize('图')).toEqual(['图']);
  });

  it('splits adjacent CJK runs at non-word separators', () => {
    expect(tokenize('向量，检索')).toEqual(['向量', '检索']);
  });

  it('lowercases latin word runs and keeps underscores/digits', () => {
    expect(tokenize('EmbeddingGemma vec_chunks FTS5')).toEqual([
      'embeddinggemma',
      'vec_chunks',
      'fts5',
    ]);
  });

  it('handles mixed CJK + latin text', () => {
    expect(tokenize('FTS5 中文检索')).toEqual(['fts5', '中文', '文检', '检索']);
  });

  it('returns empty for empty / separator-only input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('，。 /')).toEqual([]);
  });

  it('never emits quote or FTS syntax characters inside tokens', () => {
    for (const token of tokenize('"向量" (OR) -x-')) {
      expect(token).not.toMatch(/["()*]/u);
    }
  });
});

describe('tokenizeForIndex', () => {
  it('joins tokens with single spaces', () => {
    expect(tokenizeForIndex('向量数据库 向量')).toBe('向量 量数 数据 据库 向量');
  });
});

describe('buildMatchQuery', () => {
  it('OR-joins quoted tokens', () => {
    expect(buildMatchQuery('向量数据库')).toBe('"向量" OR "量数" OR "数据" OR "据库"');
  });

  it('mixes latin and CJK tokens', () => {
    expect(buildMatchQuery('FTS5 向量')).toBe('"fts5" OR "向量"');
  });

  it('returns empty string when no tokens', () => {
    expect(buildMatchQuery('')).toBe('');
    expect(buildMatchQuery('  ，  ')).toBe('');
  });
});
