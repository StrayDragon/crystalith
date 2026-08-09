import { describe, expect, it } from 'vitest';

import {
  extractCitationIds,
  parseReportBlocks,
  parseReportSections,
} from '../../research-lab/model/reportDocument';
import { answerFromChunks, retrieveReportChunks } from './reportRag';
import { getLabScenario } from './scenarios';

describe('reportRag', () => {
  it('retrieves chunks matching query keywords from report + citations', () => {
    const scenario = getLabScenario('xlsx-lib');
    const chunks = retrieveReportChunks(
      'Excel 流式 性能',
      scenario.reportMarkdown,
      scenario.citations,
    );
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]!.score).toBeGreaterThan(0);
  });

  it('answers with citation ids when citation chunks hit', () => {
    const scenario = getLabScenario('xlsx-lib');
    const chunks = retrieveReportChunks('库', scenario.reportMarkdown, scenario.citations, 5);
    const ans = answerFromChunks('推荐哪个库？', chunks);
    expect(ans.text).toContain('推荐哪个库');
    expect(ans.chunks.length).toBeGreaterThan(0);
  });
});

describe('reportDocument blocks', () => {
  it('parses sections and citation ids', () => {
    const scenario = getLabScenario('xlsx-lib');
    const sections = parseReportSections(scenario.reportMarkdown);
    expect(sections.length).toBeGreaterThan(1);
    expect(extractCitationIds(scenario.reportMarkdown)).toContain('c2');
  });

  it('parses notion-like paragraph blocks', () => {
    const scenario = getLabScenario('xlsx-lib');
    const blocks = parseReportBlocks(scenario.reportMarkdown);
    expect(blocks.some((b) => b.kind === 'heading')).toBe(true);
    expect(blocks.some((b) => b.kind === 'paragraph' || b.kind === 'list_item')).toBe(true);
    expect(blocks.some((b) => b.citationIds.includes('c2'))).toBe(true);
  });

  it('extracts [^@nodeId] block anchors without treating them as citations', () => {
    const md = '### 候选库\n\n正文[^@n-libs][^c1]\n';
    const blocks = parseReportBlocks(md);
    const para = blocks.find((b) => b.kind === 'paragraph');
    expect(para?.nodeIds).toEqual(['n-libs']);
    expect(para?.citationIds).toEqual(['c1']);
    expect(extractCitationIds(md)).toEqual(['c1']);
  });
});
