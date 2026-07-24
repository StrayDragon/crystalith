import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markdownToResearchReport } from './markdownToResearchReport';
import { researchReportToMarkdown } from './researchReportToMarkdown';

describe('markdownToResearchReport', () => {
  it('round-trips title and section from researchReportToMarkdown', () => {
    const base = {
      title: '研究报告：主题',
      sections: [
        {
          id: 'overview',
          heading: '概述',
          blocks: [{ type: 'paragraph' as const, text: '围绕主题的结论。', citeIds: ['c1'] }],
        },
      ],
      citations: {
        c1: { sourceName: '来源A', snippet: '证据片段' },
      },
    };
    const md = researchReportToMarkdown(base);
    const back = markdownToResearchReport(md, base);
    expect(back.title).toBe('研究报告：主题');
    expect(back.sections[0]?.heading).toBe('概述');
    expect(back.sections[0]?.blocks[0]).toMatchObject({
      type: 'paragraph',
      citeIds: ['c1'],
    });
    expect(back.citations).toEqual(base.citations);
  });
});
