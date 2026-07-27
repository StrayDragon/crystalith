import { describe, expect, it } from 'vitest';

import { stripFootnoteDefinitions, withFootnoteDefinitions } from './reportFootnotes';
import type { LabCitation } from './types';

const citations: Record<string, LabCitation> = {
  c1: {
    id: 'c1',
    title: 'openpyxl docs',
    url: 'https://example.com',
    snippet: 's',
    kind: 'docs',
  },
};

describe('reportFootnotes', () => {
  it('appends GFM footnote definitions for inline [^id]', () => {
    const md = 'Use openpyxl[^c1] today.\n';
    const out = withFootnoteDefinitions(md, citations);
    expect(out).toContain('openpyxl[^c1]');
    expect(out).toContain('[^c1]: openpyxl docs');
  });

  it('appends defs for [^@nodeId] anchors', () => {
    const md = 'Finding[^@n-libs] and cite[^c1].\n';
    const out = withFootnoteDefinitions(md, citations);
    expect(out).toContain('[^@n-libs]: lab-node:n-libs');
    expect(out).toContain('[^c1]: openpyxl docs');
  });

  it('strips trailing definitions for CoW storage', () => {
    const md = 'Use openpyxl[^c1].\n\n[^c1]: openpyxl docs\n';
    expect(stripFootnoteDefinitions(md).trim()).toBe('Use openpyxl[^c1].');
  });
});
