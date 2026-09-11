import { describe, expect, it } from '@rstest/core';

import {
  demoResearchLabPath,
  demoResearchLabReportPath,
  parseDemoResearchLabPath,
} from './demoRouting';

describe('demo research lab routing', () => {
  it('parses /demo/research-lab/:notebookId and /report', () => {
    expect(parseDemoResearchLabPath('/demo/research-lab/42')).toEqual({
      notebookId: 42,
      view: 'graph',
    });
    expect(parseDemoResearchLabPath('/demo/research-lab/42/report')).toEqual({
      notebookId: 42,
      view: 'report',
    });
    expect(parseDemoResearchLabPath('/demo/research-lab/0')).toBeNull();
    expect(parseDemoResearchLabPath('/research-lab/42')).toBeNull();
    expect(parseDemoResearchLabPath('/')).toBeNull();
    expect(demoResearchLabPath(7)).toBe('/demo/research-lab/7');
    expect(demoResearchLabReportPath(7)).toBe('/demo/research-lab/7/report');
  });
});
