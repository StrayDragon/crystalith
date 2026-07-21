// Tests for the tokenizer (gpt-tokenizer).
import { describe, expect, it } from 'bun:test';

import { countTokens, countMessageTokens, truncateToTokens } from '../src/ai/tokenizer.ts';

describe('tokenizer', () => {
  it('counts tokens in a string', () => {
    expect(countTokens('')).toBe(0);
    expect(countTokens('hello world')).toBeGreaterThan(0);
    // "hello world" is 2 tokens in cl100k_base.
    expect(countTokens('hello world')).toBe(2);
  });

  it('counts message overhead', () => {
    const total = countMessageTokens([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ]);
    expect(total).toBeGreaterThan(countTokens('hello') + countTokens('hi there'));
  });

  it('truncates text to a token budget', () => {
    const long = 'word '.repeat(1000);
    const truncated = truncateToTokens(long, 10);
    expect(countTokens(truncated)).toBeLessThanOrEqual(10);
  });

  it('returns text unchanged when within budget', () => {
    expect(truncateToTokens('short', 100)).toBe('short');
  });
});
