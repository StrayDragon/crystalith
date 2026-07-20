// CSV parser — markdown-table cell escape/truncate (c53 / Wave D.1 regression).
import { describe, expect, it } from 'bun:test';

import { csvParser } from '../../src/features/sources/parsers/csv.ts';

describe('csvParser markdown-table safety', () => {
  it('escapes pipes and newlines, truncates with …', async () => {
    const csv = ['a,b', 'x|y,"line1\nline2"', 'short,ok'].join('\n');
    const result = await csvParser.parse(new TextEncoder().encode(csv), 't.csv');
    const text = result.text ?? '';
    expect(text).toContain('\\|');
    expect(text).not.toMatch(/\| x\|y \|/);
    // newlines in cells become spaces (not raw breaks inside a table row)
    expect(text).toContain('line1 line2');
    // long cell truncation uses … not ...
    const long = 'c'.repeat(250);
    const longCsv = ['h', long].join('\n');
    const longResult = await csvParser.parse(new TextEncoder().encode(longCsv), 'long.csv');
    expect(longResult.text).toContain('…');
    expect(longResult.text).not.toMatch(/c{201}\.\.\./);
  });
});
