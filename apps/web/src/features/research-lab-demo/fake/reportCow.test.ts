import { afterEach, describe, expect, it } from 'vitest';

import {
  activeReportMarkdown,
  applyReportEdit,
  buildCanonical,
  clearWorkingCopy,
  orphanCitationIds,
  persistWorkingCopy,
  readWorkingCopy,
  workingCopyStorageKey,
} from './reportCow';

describe('reportCow', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('activeReportMarkdown prefers working when viewing working', () => {
    const canonical = buildCanonical({
      scenarioId: 'xlsx-lib',
      notebookId: 1,
      markdown: '# Canon\nA [^c1]',
      producedAt: '2026-01-01T00:00:00.000Z',
    });
    const working = {
      ...canonical,
      markdown: '# Edit\nB [^c1]',
      forkedFromProducedAt: canonical.producedAt,
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    expect(activeReportMarkdown(canonical, working, 'canonical')).toBe(canonical.markdown);
    expect(activeReportMarkdown(canonical, working, 'working')).toBe(working.markdown);
    expect(activeReportMarkdown(canonical, null, 'working')).toBe(canonical.markdown);
  });

  it('applyReportEdit forks on first change then updates copy', () => {
    const canonical = buildCanonical({
      scenarioId: 'xlsx-lib',
      notebookId: 7,
      markdown: 'Hello [^a]',
      producedAt: '2026-01-01T00:00:00.000Z',
    });
    const first = applyReportEdit({
      canonical,
      working: null,
      nextMarkdown: 'Hello edited [^a]',
      now: '2026-01-02T00:00:00.000Z',
    });
    expect(first.forked).toBe(true);
    expect(first.working.markdown).toBe('Hello edited [^a]');
    expect(first.working.forkedFromProducedAt).toBe(canonical.producedAt);
    expect(canonical.markdown).toBe('Hello [^a]');

    const second = applyReportEdit({
      canonical,
      working: first.working,
      nextMarkdown: 'Hello again',
      now: '2026-01-03T00:00:00.000Z',
    });
    expect(second.forked).toBe(false);
    expect(second.working.markdown).toBe('Hello again');
    expect(second.working.updatedAt).toBe('2026-01-03T00:00:00.000Z');
  });

  it('orphanCitationIds lists cites removed from active body', () => {
    expect(orphanCitationIds('A [^c1] B [^c2]', 'A [^c1]')).toEqual(['c2']);
    expect(orphanCitationIds('A [^c1]', 'A [^c1] B [^c2]')).toEqual([]);
  });

  it('persists and clears working copy in sessionStorage', () => {
    const key = workingCopyStorageKey(3, 'xlsx-lib');
    expect(readWorkingCopy(3, 'xlsx-lib')).toBeNull();

    const copy = {
      scenarioId: 'xlsx-lib',
      notebookId: 3,
      markdown: 'fork',
      forkedFromProducedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    persistWorkingCopy(copy);
    expect(sessionStorage.getItem(key)).toBeTruthy();
    expect(readWorkingCopy(3, 'xlsx-lib')).toEqual(copy);

    clearWorkingCopy(3, 'xlsx-lib');
    expect(readWorkingCopy(3, 'xlsx-lib')).toBeNull();
  });
});
