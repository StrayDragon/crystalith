import { describe, expect, it } from '@rstest/core';

import { resolveEdenExportFromReport, resolveEdenOpenReport } from './edenReportActions';
import { researchLabReportPath } from './labRouting';
import { adaptResearchCitationsToUi } from './researchCitationsAdapter';
import { researchReportToMarkdown } from './researchReportToMarkdown';

describe('resolveEdenOpenReport', () => {
  it('navigates with rid when runId is valid', () => {
    expect(resolveEdenOpenReport(62, 9)).toEqual({ ok: true, notebookId: 62, runId: 9 });
    expect(researchLabReportPath(62, 9)).toBe('/research-lab/62/report?rid=9');
  });

  it('errors when runId missing', () => {
    expect(resolveEdenOpenReport(62, null).ok).toBe(false);
    expect(resolveEdenOpenReport(62, 0).ok).toBe(false);
  });
});

describe('resolveEdenExportFromReport', () => {
  const report = {
    title: '研究报告：主题',
    sections: [
      {
        id: 'overview',
        heading: '概述',
        blocks: [{ type: 'paragraph' as const, text: '正文', citeIds: ['c1'] }],
      },
    ],
    citations: {
      c1: { sourceName: '源', snippet: '片段', url: 'https://example.com' },
    },
  };

  it('serializes report markdown and does not use stub toast path', () => {
    const resolved = resolveEdenExportFromReport(report);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.markdown).toContain('# 研究报告：主题');
    expect(resolved.markdown).toContain('## 概述');
    expect(resolved.markdown).toContain('正文');
    expect(resolved.markdown).toContain('参考文献');
  });

  it('errors when report missing', () => {
    const resolved = resolveEdenExportFromReport(null);
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.error).toMatch(/尚无报告/);
  });
});

describe('researchReportToMarkdown', () => {
  it('renders bullets and citations', () => {
    const md = researchReportToMarkdown({
      title: 'T',
      sections: [
        {
          id: 's',
          heading: 'H',
          blocks: [
            {
              type: 'bullets',
              items: [{ text: 'item', citeIds: ['c1'] }],
            },
          ],
        },
      ],
      citations: {
        c1: { sourceName: 'A', snippet: 'snip' },
      },
    });
    expect(md).toContain('- item[^1]');
    expect(md).toContain('[^1]: A — snip');
  });
});

describe('adaptResearchCitationsToUi', () => {
  it('maps ResearchCitation map to CitationsControl shape', () => {
    const ui = adaptResearchCitationsToUi({
      c1: {
        sourceName: 'Doc',
        snippet: 'hello',
        chunkId: 12,
        chunkIndex: 1,
        sourceId: 3,
      },
    });
    expect(ui).toEqual([
      {
        id: 'c1',
        chunkId: 12,
        sourceId: 3,
        sourceName: 'Doc',
        snippet: 'hello',
        chunkIndex: 1,
        pageNumber: null,
        paragraphIndex: null,
        score: undefined,
      },
    ]);
  });
});
