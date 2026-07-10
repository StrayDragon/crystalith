// parseBullets unit test — faithful port of v1 utils/text.py:23-30.
//
// v1 behavior: iterate each line, strip whitespace + leading "-", strip
// again, keep non-empty. Does NOT match "•", "*", or numbered prefixes.
import { describe, expect, it } from 'bun:test';

import { parseBullets } from '../../src/features/refine/format.ts';

describe('parseBullets (v1-aligned)', () => {
  it('strips leading dashes from each line', () => {
    expect(parseBullets('- first\n- second\n- third')).toEqual(['first', 'second', 'third']);
  });

  it('strips multiple leading dashes', () => {
    expect(parseBullets('-- deep dash')).toEqual(['deep dash']);
  });

  it('skips empty lines', () => {
    expect(parseBullets('a\n\n\nb')).toEqual(['a', 'b']);
  });

  it('processes ALL non-empty lines, not just bullet-marked ones', () => {
    // v1 does NOT match "•" or "*" — it strips "-" only, keeps everything else.
    expect(parseBullets('• dot\n* star\n1. numbered\nplain')).toEqual([
      '• dot',
      '* star',
      '1. numbered',
      'plain',
    ]);
  });

  it('trims whitespace around each line', () => {
    expect(parseBullets('  - spaced  \n\t indented')).toEqual(['spaced', 'indented']);
  });

  it('returns empty array for empty input', () => {
    expect(parseBullets('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(parseBullets('   \n\n  \t ')).toEqual([]);
  });
});
