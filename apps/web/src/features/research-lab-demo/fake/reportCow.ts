import { extractCitationIds } from '../../research-lab/model/reportDocument';

const WORKING_KEY_PREFIX = 'crystalith.research-lab.report-working';

/** Immutable research-run output. Never mutated by the editor. */
export interface ReportCanonical {
  scenarioId: string;
  notebookId: number;
  markdown: string;
  producedAt: string;
}

/** User fork created on first edit (copy-on-write). */
export interface ReportWorkingCopy {
  scenarioId: string;
  notebookId: number;
  markdown: string;
  forkedFromProducedAt: string;
  updatedAt: string;
}

export type ReportViewSource = 'canonical' | 'working';

export function workingCopyStorageKey(notebookId: number, scenarioId: string): string {
  return `${WORKING_KEY_PREFIX}.${notebookId}.${scenarioId}`;
}

export function buildCanonical(input: {
  scenarioId: string;
  notebookId: number;
  markdown: string;
  producedAt?: string;
}): ReportCanonical {
  return {
    scenarioId: input.scenarioId,
    notebookId: input.notebookId,
    markdown: input.markdown,
    producedAt: input.producedAt ?? new Date(0).toISOString(),
  };
}

/** Active markdown for the current view (working if present & selected). */
export function activeReportMarkdown(
  canonical: ReportCanonical,
  working: ReportWorkingCopy | null,
  viewing: ReportViewSource,
): string {
  if (viewing === 'working' && working) return working.markdown;
  return canonical.markdown;
}

/**
 * Copy-on-write: first edit forks canonical → working; later edits update working.
 * Never mutates canonical.
 */
export function applyReportEdit(input: {
  canonical: ReportCanonical;
  working: ReportWorkingCopy | null;
  nextMarkdown: string;
  now?: string;
}): { working: ReportWorkingCopy; forked: boolean } {
  const now = input.now ?? new Date().toISOString();
  if (!input.working) {
    return {
      forked: true,
      working: {
        scenarioId: input.canonical.scenarioId,
        notebookId: input.canonical.notebookId,
        markdown: input.nextMarkdown,
        forkedFromProducedAt: input.canonical.producedAt,
        updatedAt: now,
      },
    };
  }
  return {
    forked: false,
    working: {
      ...input.working,
      markdown: input.nextMarkdown,
      updatedAt: now,
    },
  };
}

/** Cite ids present in canonical but missing from active markdown. */
export function orphanCitationIds(canonicalMarkdown: string, activeMarkdown: string): string[] {
  const canon = extractCitationIds(canonicalMarkdown);
  const active = new Set(extractCitationIds(activeMarkdown));
  return canon.filter((id) => !active.has(id));
}

export function readWorkingCopy(notebookId: number, scenarioId: string): ReportWorkingCopy | null {
  try {
    const raw = sessionStorage.getItem(workingCopyStorageKey(notebookId, scenarioId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReportWorkingCopy;
    if (
      !parsed ||
      parsed.notebookId !== notebookId ||
      parsed.scenarioId !== scenarioId ||
      typeof parsed.markdown !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function persistWorkingCopy(copy: ReportWorkingCopy): void {
  try {
    sessionStorage.setItem(
      workingCopyStorageKey(copy.notebookId, copy.scenarioId),
      JSON.stringify(copy),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearWorkingCopy(notebookId: number, scenarioId: string): void {
  try {
    sessionStorage.removeItem(workingCopyStorageKey(notebookId, scenarioId));
  } catch {
    /* ignore */
  }
}
