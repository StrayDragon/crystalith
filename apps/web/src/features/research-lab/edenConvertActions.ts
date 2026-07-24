import type { ResearchArtifactRef } from '@crystalith/shared';

import { toast } from '../../shared/toast';
import { convertResearchToNote, convertResearchToSource } from './edenResearchApi';
import { navigateToWorkspace } from './labRouting';

export type EdenConvertResult =
  | { ok: true; kind: 'note'; outputId: number }
  | { ok: true; kind: 'source'; sourceId: number; filename: string; chunkCount: number }
  | { ok: false; error: string };

const OPEN_WORKSPACE_ACTION = {
  label: '打开工作区',
  onClick: () => {
    navigateToWorkspace();
  },
} as const;

/** Convert artifact → note with toast feedback (r409 / r443 / r446). No confirm dialog. */
export async function runConvertToNote(
  notebookId: number,
  runId: number,
  artifact: ResearchArtifactRef,
): Promise<EdenConvertResult> {
  try {
    const res = await convertResearchToNote(notebookId, runId, artifact);
    toast.success(`已转为笔记 #${res.outputId}`, {
      duration: 4500,
      action: OPEN_WORKSPACE_ACTION,
    });
    return { ok: true, kind: 'note', outputId: res.outputId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.error(`转为笔记失败：${message}`, 5000);
    return { ok: false, error: message };
  }
}

/** Convert artifact → source with toast feedback (r409 / r443 / r446). No confirm dialog. */
export async function runConvertToSource(
  notebookId: number,
  runId: number,
  artifact: ResearchArtifactRef,
): Promise<EdenConvertResult> {
  try {
    const res = await convertResearchToSource(notebookId, runId, artifact);
    toast.success(`已转为来源 #${res.sourceId}：${res.filename}（${res.chunkCount} 块）`, {
      duration: 4500,
      action: OPEN_WORKSPACE_ACTION,
    });
    return {
      ok: true,
      kind: 'source',
      sourceId: res.sourceId,
      filename: res.filename,
      chunkCount: res.chunkCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.error(`转为来源失败：${message}`, 5000);
    return { ok: false, error: message };
  }
}
