import type { SourceTag } from '@crystalith/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';
import { parseServerError } from '../../../../api/parseServerError';
import { toast } from '../../../../shared/toast';
import type { AsyncStatus } from '../../../../shared/types';
import type { SourceSeamContext } from './sourceSeamContext';

type SourceTagRead = SourceTag;

/** Source tag CRUD + assignment seam (W6). */
export function useSourceTags(
  ctx: SourceSeamContext,
  listQuery: { tagFilter: string; setTagFilter: (v: string) => void },
) {
  const { activeNotebookId, isConnected, mutate } = ctx;
  const { tagFilter, setTagFilter } = listQuery;
  const [tagMutationState, setTagMutationState] = useState<AsyncStatus>('idle');

  useEffect(() => {
    setTagMutationState('idle');
  }, [activeNotebookId]);

  const { data: tagsData, mutate: mutateTags } = useSWR<SourceTagRead[]>(
    activeNotebookId && isConnected ? ['workspace/source-tags', activeNotebookId] : null,
    () =>
      api.v2
        .notebooks({ nid: activeNotebookId! })
        .sources.tags.get()
        .then((r) => {
          if (r.error) throw new Error(parseServerError(r.error).message);
          return r.data ?? [];
        }),
    { revalidateOnFocus: false },
  );

  const handleCreateSourceTag = useCallback(
    async (name: string) => {
      if (!isConnected || !activeNotebookId) return null;
      setTagMutationState('loading');
      try {
        const { data: tag, error: ctErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sources.tags.post({ name });
        if (ctErr) throw new Error(parseServerError(ctErr).message);
        if (!tag || !('id' in tag)) throw new Error('创建标签失败');
        await mutateTags();
        await mutate();
        toast.success('标签创建成功');
        return tag;
      } catch {
        toast.error('创建标签失败');
        return null;
      } finally {
        setTagMutationState('idle');
      }
    },
    [isConnected, activeNotebookId, mutateTags, mutate],
  );

  const handleRenameSourceTag = useCallback(
    async (tagId: number, name: string) => {
      if (!isConnected || !activeNotebookId) return null;
      setTagMutationState('loading');
      try {
        const { data: tag, error: utErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sources.tags({ tid: tagId })
          .patch({ name });
        if (utErr) throw new Error(parseServerError(utErr).message);
        if (!tag || !('id' in tag)) throw new Error('更新标签失败');
        await mutateTags();
        await mutate();
        toast.success('标签已更新');
        return tag;
      } catch {
        toast.error('更新标签失败');
        return null;
      } finally {
        setTagMutationState('idle');
      }
    },
    [isConnected, activeNotebookId, mutateTags, mutate],
  );

  const handleDeleteSourceTag = useCallback(
    async (tagId: number) => {
      if (!isConnected || !activeNotebookId) return false;
      setTagMutationState('loading');
      try {
        const { error: dtErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sources.tags({ tid: tagId })
          .delete();
        if (dtErr) throw new Error(parseServerError(dtErr).message);
        await mutateTags();
        await mutate();
        if (tagFilter && tagsData?.some((item) => item.id === tagId && item.name === tagFilter)) {
          setTagFilter('');
        }
        toast.success('标签已删除');
        return true;
      } catch {
        toast.error('删除标签失败');
        return false;
      } finally {
        setTagMutationState('idle');
      }
    },
    [isConnected, activeNotebookId, mutateTags, mutate, tagFilter, tagsData],
  );

  const handleAssignTagToSources = useCallback(
    async (tagId: number, sourceIds: number[]) => {
      if (!isConnected || !activeNotebookId || !sourceIds.length) return false;
      setTagMutationState('loading');
      try {
        const { error: atErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sources.tags({ tid: tagId })
          .sources.post({ sourceIds });
        if (atErr) throw new Error(parseServerError(atErr).message);
        await mutateTags();
        await mutate();
        toast.success('标签已分配');
        return true;
      } catch {
        toast.error('标签分配失败');
        return false;
      } finally {
        setTagMutationState('idle');
      }
    },
    [isConnected, activeNotebookId, mutateTags, mutate],
  );

  const handleRemoveTagFromSources = useCallback(
    async (tagId: number, sourceIds: number[]) => {
      if (!isConnected || !activeNotebookId || !sourceIds.length) return false;
      setTagMutationState('loading');
      try {
        const { error: rtErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sources.tags({ tid: tagId })
          .sources.delete({ sourceIds });
        if (rtErr) throw new Error(parseServerError(rtErr).message);
        await mutateTags();
        await mutate();
        toast.success('标签已移除');
        return true;
      } catch {
        toast.error('移除标签失败');
        return false;
      } finally {
        setTagMutationState('idle');
      }
    },
    [isConnected, activeNotebookId, mutateTags, mutate],
  );

  const sourceTags = useMemo<SourceTagRead[]>(() => tagsData ?? [], [tagsData]);

  return {
    sourceTags,
    tagMutationState,
    createSourceTag: handleCreateSourceTag,
    renameSourceTag: handleRenameSourceTag,
    deleteSourceTag: handleDeleteSourceTag,
    assignTagToSources: handleAssignTagToSources,
    removeTagFromSources: handleRemoveTagFromSources,
  };
}
