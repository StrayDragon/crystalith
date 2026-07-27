import { createContext, useContext, type ReactNode } from 'react';

import type { LabCitation } from '../research-lab-demo/fake/types';

export type CiteActivateOptions = {
  /** 0-based occurrence among pills with the same citationId (document order). */
  occurrence?: number;
  /** Prefer this element as scroll/popover anchor when provided. */
  anchorEl?: HTMLElement | null;
};

export type LabReportCiteContextValue = {
  citations: Record<string, LabCitation>;
  orphanIds: Set<string>;
  showCitations: boolean;
  activeCitationId: string | null;
  /** `${citationId}#${occurrence}` of the focused pill, when known. */
  activeCiteKey: string | null;
  selectedBlockId: string | null;
  readOnly: boolean;
  /** Pass '' to close. */
  onCite: (citationId: string, opts?: CiteActivateOptions) => void;
  /** Jump to thinking-graph node from `[^@nodeId]` anchor. */
  onLocateNode?: (nodeId: string) => void;
  onSelectBlock: (blockId: string | null) => void;
};

const LabReportCiteContext = createContext<LabReportCiteContextValue | null>(null);

export function LabReportCiteProvider({
  value,
  children,
}: {
  value: LabReportCiteContextValue;
  children: ReactNode;
}) {
  return <LabReportCiteContext.Provider value={value}>{children}</LabReportCiteContext.Provider>;
}

export function useLabReportCite(): LabReportCiteContextValue {
  const ctx = useContext(LabReportCiteContext);
  if (!ctx) {
    return {
      citations: {},
      orphanIds: new Set(),
      showCitations: false,
      activeCitationId: null,
      activeCiteKey: null,
      selectedBlockId: null,
      readOnly: true,
      onCite: () => {},
      onLocateNode: undefined,
      onSelectBlock: () => {},
    };
  }
  return ctx;
}
