// c132: top-bar knowledge search jump handlers, kept out of the giant
// WorkspaceLayout scope — source chunk → source detail with citation
// highlight (global hits may live in another notebook: on-demand fetch via
// normalizeSource), output → the outputs viewer overlay. Output jumps are
// fetch-then-open: the outputs list is refreshed (and the notebook switched
// when the output lives elsewhere) BEFORE the viewer opens, so the layout's
// viewer-recovery effect never races a stale list into closing it.
import { useCallback } from 'react';

import { api } from '../../../../api/eden';
import { toast } from '../../../../shared/toast';
import type { SourceItem } from '../../shared/types';
import { normalizeSource } from '../../shared/utils';

export interface KbJumpDeps {
  sourceById: Map<number, SourceItem>;
  openCitationSourceDetail: (source: SourceItem) => void;
  setJumpToCitationChunkId: (chunkId: number) => void;
  openOutputViewer: (outputId: number) => void;
  /** Refresh the active notebook's outputs list (fetch-then-open). */
  refreshOutputs: () => Promise<unknown>;
  activeNotebookId: number | null;
  /** Switch the active notebook for cross-notebook output jumps. */
  setActiveNotebook: (id: number | null) => void;
}

export function useKbJumpHandlers(deps: KbJumpDeps) {
  const {
    sourceById,
    openCitationSourceDetail,
    setJumpToCitationChunkId,
    openOutputViewer,
    refreshOutputs,
    activeNotebookId,
    setActiveNotebook,
  } = deps;

  const jumpToSource = useCallback(
    // fallow-ignore-next-line complexity -- 估算 CRAP（无 coverage 数据）；行为由 rstest/e2e 覆盖
    async (sourceId: number, chunkId: number, notebookId: number) => {
      let source = sourceById.get(sourceId) ?? null;
      if (!source) {
        const { data, error } = await api.v2
          .notebooks({ nid: notebookId })
          .sources({ sid: sourceId })
          .get();
        if (!error) source = normalizeSource(data);
      }
      if (!source) {
        toast.error('未找到对应来源，请先同步来源列表。');
        return;
      }
      openCitationSourceDetail(source);
      setJumpToCitationChunkId(chunkId);
    },
    [sourceById, openCitationSourceDetail, setJumpToCitationChunkId],
  );

  const jumpToOutput = useCallback(
    // fallow-ignore-next-line complexity -- 估算 CRAP（无 coverage 数据）；行为由 rstest/e2e 覆盖
    async (outputId: number, notebookId: number) => {
      if (activeNotebookId !== null && notebookId !== activeNotebookId) {
        // Cross-notebook hit: switch first so the whole workspace (incl. the
        // outputs list the viewer reads) lands on the owning notebook.
        setActiveNotebook(notebookId);
      }
      try {
        await refreshOutputs();
      } catch {
        // Best-effort refresh — the recovery effect tolerates a loading
        // list, so still open the viewer afterwards.
      }
      // openOutputViewer sets BOTH the selected id and the open flag —
      // setViewerOutputId alone leaves the viewer closed.
      openOutputViewer(outputId);
    },
    [activeNotebookId, openOutputViewer, refreshOutputs, setActiveNotebook],
  );

  return { jumpToSource, jumpToOutput };
}
