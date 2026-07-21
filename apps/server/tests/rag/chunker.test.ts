// Tests for the chunker (config-driven chunk_size, default 512 per v1 embedding.chunk_size).
import { afterEach, describe, expect, it } from 'bun:test';

import { chunkText, DEFAULT_CHUNKER_CONFIG } from '../../src/rag/chunker.ts';
import { resetConfig } from '../../src/shared/config.ts';

afterEach(() => resetConfig());

describe('chunker', () => {
  it('DEFAULT_CHUNKER_CONFIG is the v1 fallback (512/102)', () => {
    expect(DEFAULT_CHUNKER_CONFIG.maxLen).toBe(512);
    expect(DEFAULT_CHUNKER_CONFIG.overlap).toBe(102);
  });

  it('chunks short text into a single chunk', () => {
    const result = chunkText('Hello world.');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Hello world.');
    expect(result[0].index).toBe(0);
  });

  it('splits a long paragraph with sentences, each ≤ maxLen', () => {
    // Many sentences in one paragraph (no double-newline) → split by sentence
    // with overlap so each chunk stays within maxLen.
    const sentences = Array.from({ length: 50 }, (_, i) => `Sentence number ${i} here. `).join('');
    const result = chunkText(sentences);
    expect(result.length).toBeGreaterThan(1);
    for (const c of result) {
      expect(c.text.length).toBeLessThanOrEqual(512);
    }
  });

  it('splits on paragraph boundaries', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird.';
    const result = chunkText(text);
    expect(result).toHaveLength(3);
    expect(result[0].text).toBe('First paragraph.');
    expect(result[2].text).toBe('Third.');
  });

  it('assigns sequential indices', () => {
    const text = Array.from({ length: 5 }, (_, i) => `Para ${i}.`).join('\n\n');
    const result = chunkText(text);
    expect(result.map((c) => c.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it('skips empty paragraphs', () => {
    const text = 'A.\n\n\n\nB.';
    const result = chunkText(text);
    expect(result).toHaveLength(2);
  });

  it('honors explicit config override', () => {
    const long = 'Sentence one. '.repeat(100);
    const result = chunkText(long, { maxLen: 200, overlap: 20 });
    expect(result.length).toBeGreaterThan(1);
    for (const c of result) {
      expect(c.text.length).toBeLessThanOrEqual(200);
    }
  });
});
