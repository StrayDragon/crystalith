import { describe, expect, it } from '@rstest/core';

import { readResearchLabOrigin } from './researchLabOrigin';

describe('readResearchLabOrigin', () => {
  it('reads stamped researchLab on content', () => {
    expect(
      readResearchLabOrigin({
        title: 't',
        text: 'body',
        researchLab: { notebookId: 62, runId: 10, artifactKind: 'report' },
      }),
    ).toEqual({ notebookId: 62, runId: 10, artifactKind: 'report' });
  });

  it('reads list-row researchLab field', () => {
    expect(
      readResearchLabOrigin({ content: null, researchLab: { notebookId: 1, runId: 9 } }),
    ).toEqual({ notebookId: 1, runId: 9, artifactKind: undefined });
  });

  it('returns null when missing or invalid', () => {
    expect(readResearchLabOrigin({ text: 'x' })).toBeNull();
    expect(readResearchLabOrigin({ researchLab: { notebookId: 0, runId: 1 } })).toBeNull();
    expect(readResearchLabOrigin(null)).toBeNull();
  });
});
