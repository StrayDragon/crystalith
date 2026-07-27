import { describe, expect, it } from 'vitest';

import { parseResearchLabPath, researchLabPath, researchLabReportPath } from './labRouting';

describe('research lab routing', () => {
  it('parses /research-lab/:notebookId and /report', () => {
    expect(parseResearchLabPath('/research-lab/42')).toEqual({
      notebookId: 42,
      view: 'graph',
    });
    expect(parseResearchLabPath('/research-lab/42/report')).toEqual({
      notebookId: 42,
      view: 'report',
    });
    expect(parseResearchLabPath('/research-lab/0')).toBeNull();
    expect(parseResearchLabPath('/demo/research-lab/42')).toBeNull();
    expect(parseResearchLabPath('/')).toBeNull();
    expect(researchLabPath(7)).toBe('/research-lab/7');
    expect(researchLabReportPath(7)).toBe('/research-lab/7/report');
    expect(researchLabReportPath(7, 9)).toBe('/research-lab/7/report?rid=9');
  });
});
