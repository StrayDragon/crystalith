import type {
  ExtractorInfo,
  ExtractorsList,
  NotebookExtractorsPolicyView,
  PatchNotebookExtractorPolicy,
  QAMessage,
  SourceFromUrlMode,
  SourceSearchResult,
  SourceTag,
} from '@crystalith/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';
import { parseServerError } from '../../../../api/parseServerError';
import { toast } from '../../../../shared/toast';
import type { AsyncStatus } from '../../../../shared/types';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import { normalizeSource } from '../../shared/utils';

type ExtractorType = ExtractorInfo['type'];
type NotebookExtractorsPolicy = NotebookExtractorsPolicyView;
type PatchNotebookExtractorsPolicyRequest = PatchNotebookExtractorPolicy;
type SourceTagRead = SourceTag;
type QaMessage = QAMessage;
type ExtractorsListResponse = ExtractorsList;

/** 搜索队列项状态 */
export type SearchQueueItemStatus = 'loading' | 'success' | 'error';

/** 搜索队列项 */
export interface SearchQueueItem {
  id: string;
  query: string;
  engine: string;
  mode: string;
  status: SearchQueueItemStatus;
  results: SourceSearchResult[];
  notice: string;
  createdAt: number;
}

export interface SourceUploadItem {
  id: string;
  name: string;
  status: 'queued' | 'uploading' | 'success' | 'error';
  message?: string;
}

export type SourceSortBy = 'date' | 'name' | 'size' | 'type';
export type SourceSortOrder = 'asc' | 'desc';

function normalizeUploadInput(input: File | File[] | FileList | null): File[] {
  if (!input) return [];
  if (input instanceof File) return [input];
  if (input instanceof FileList) return Array.from(input);
  if (Array.isArray(input)) return input.filter((item): item is File => item instanceof File);
  return [];
}

/** Align with backend url_fetch + extractor retries (config/app.yaml source_ingestion.*). */
const SOURCE_FROM_URL_FETCH_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(message));
      }, ms);
    }),
  ]);
}

export function useSources() {
  const activeNotebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const sources = useWorkspaceStore((s) => s.sources);
  const citations = useWorkspaceStore((s) => s.citations);
  const hoveredCitationChunkId = useWorkspaceStore((s) => s.hoveredCitationChunkId);
  const hoveredMessageChunkIds = useWorkspaceStore((s) => s.hoveredMessageChunkIds);
  const jumpToCitationChunkId = useWorkspaceStore((s) => s.jumpToCitationChunkId);
  const uploadStateCurrent = useWorkspaceStore((s) => s.uploadState);
  const connectionState = useWorkspaceStore((s) => s.connectionState);
  const loadingSources = useWorkspaceStore((s) => s.loading.sources);

  const store = useWorkspaceStore;
  const isConnected = connectionState === 'live';

  const [searchState, setSearchState] = useState<AsyncStatus>('idle');
  const [removeState, setRemoveState] = useState<AsyncStatus>('idle');
  const [batchReembedState, setBatchReembedState] = useState<AsyncStatus>('idle');
  const [tagMutationState, setTagMutationState] = useState<AsyncStatus>('idle');
  const [uploadError, setUploadError] = useState('');
  const [lastFailedUploadFiles, setLastFailedUploadFiles] = useState<File[]>([]);
  const [uploadQueue, setUploadQueue] = useState<SourceUploadItem[]>([]);
  const [searchQueue, setSearchQueue] = useState<SearchQueueItem[]>([]);
  const [sortBy, setSortBy] = useState<SourceSortBy>('date');
  const [sortOrder, setSortOrder] = useState<SourceSortOrder>('desc');
  const [tagFilter, setTagFilter] = useState('');

  const searchIdRef = useRef(0);
  const maxSearchQueueItems = 20;

  const sourceListQuery = useMemo(
    () => ({
      sortBy,
      sortOrder,
      tag: tagFilter.trim() || undefined,
      offset: 0,
      limit: 200,
    }),
    [sortBy, sortOrder, tagFilter],
  );

  const { data, error, isLoading, mutate } = useSWR(
    activeNotebookId && isConnected
      ? [
          'workspace/sources',
          activeNotebookId,
          sourceListQuery.sortBy,
          sourceListQuery.sortOrder,
          sourceListQuery.tag ?? '',
        ]
      : null,
    () =>
      api.v2
        .notebooks({ nid: activeNotebookId! })
        .sources.get({ query: sourceListQuery })
        .then((r) => {
          // eslint-disable-next-line typescript/no-base-to-string
          if (r.error) throw new Error(parseServerError(r.error).message);
          return r.data?.items ?? [];
        }),
    { revalidateOnFocus: false },
  );

  const { data: tagsData, mutate: mutateTags } = useSWR<SourceTagRead[]>(
    activeNotebookId && isConnected ? ['workspace/source-tags', activeNotebookId] : null,
    () =>
      api.v2
        .notebooks({ nid: activeNotebookId! })
        .sources.tags.get()
        .then((r) => {
          // eslint-disable-next-line typescript/no-base-to-string
          if (r.error) throw new Error(parseServerError(r.error).message);
          return r.data ?? [];
        }),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    store.getState().setLoading('sources', isLoading);
  }, [isLoading, store]);

  useEffect(() => {
    if (!activeNotebookId) {
      store.getState().setSources([]);
      return;
    }
    if (!isConnected) {
      store.getState().setSources([]);
      return;
    }
    if (error) {
      toast.error('来源加载失败，请检查后端状态。');
      return;
    }
    if (data) {
      const s = store.getState();
      s.setError('sources', '');
      s.setSources(data.map(normalizeSource));
    }
  }, [data, error, isConnected, activeNotebookId, store]);

  useEffect(() => {
    store.getState().setHoveredCitation(null);
  }, [citations, store]);

  useEffect(() => {
    setSearchState('idle');
    setRemoveState('idle');
    setBatchReembedState('idle');
    setTagMutationState('idle');
    setSearchQueue([]);
    setUploadError('');
    setLastFailedUploadFiles([]);
    setUploadQueue([]);
    setTagFilter('');
  }, [activeNotebookId]);

  useEffect(() => {
    // eslint-disable-next-line eqeqeq
    if (jumpToCitationChunkId == null) return undefined;
    const timer = window.setTimeout(() => {
      store.getState().setJumpToCitation(null);
    }, 1800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [jumpToCitationChunkId, store]);

  const setHoveredCitationChunkId = useCallback(
    (chunkId: number | null) => {
      store.getState().setHoveredCitation(chunkId);
    },
    [store],
  );

  const setHoveredMessageChunkIds = useCallback(
    (chunkIds: number[] | null) => {
      const normalized = chunkIds?.filter((chunkId) => Number.isFinite(chunkId)) ?? [];
      store.getState().setHoveredMessageChunks(normalized);
    },
    [store],
  );

  const setJumpToCitationChunkId = useCallback(
    (chunkId: number | null) => {
      store.getState().setJumpToCitation(chunkId);
    },
    [store],
  );

  const highlightedChunkIds = useMemo(() => {
    const highlighted = new Set<number>();
    // eslint-disable-next-line eqeqeq
    if (hoveredCitationChunkId != null) {
      highlighted.add(hoveredCitationChunkId);
    }
    // eslint-disable-next-line eqeqeq
    if (jumpToCitationChunkId != null) {
      highlighted.add(jumpToCitationChunkId);
    }
    for (const chunkId of hoveredMessageChunkIds) {
      if (Number.isFinite(chunkId)) {
        highlighted.add(chunkId);
      }
    }
    return highlighted;
  }, [hoveredCitationChunkId, jumpToCitationChunkId, hoveredMessageChunkIds]);

  const handleUpload = useCallback(
    async (input: File | File[] | FileList | null) => {
      const files = normalizeUploadInput(input);
      if (!files.length) return;
      if (!activeNotebookId || !isConnected) {
        if (!isConnected) {
          toast.error('未连接到后端服务，无法上传来源。');
        }
        return;
      }

      const timestamp = Date.now();
      const queueItems = files.map((file, index) => ({
        id: `${timestamp}-${index}-${file.name}`,
        name: file.name,
        status: 'queued' as const,
      }));
      setUploadQueue((prev) => [...queueItems, ...prev].slice(0, 30));
      setUploadError('');
      store.getState().setUploadState('loading');

      const failedFiles: File[] = [];
      let successCount = 0;

      try {
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          const queueId = queueItems[index].id;
          setUploadQueue((prev) =>
            prev.map((item) =>
              item.id === queueId ? { ...item, status: 'uploading', message: undefined } : item,
            ),
          );
          try {
            // eslint-disable-next-line no-await-in-loop -- Upload queue + dedup confirmation requires serial execution.
            await api.v2
              .notebooks({ nid: activeNotebookId })
              // Eden treats Zod .default() query fields as required on the client.
              .sources.upload.post({ file }, { query: { dedupAction: 'prompt' } })
              .then((r) => {
                // eslint-disable-next-line typescript/no-base-to-string
                if (r.error) throw new Error(parseServerError(r.error).message);
              });
            successCount += 1;
            setUploadQueue((prev) =>
              prev.map((item) => (item.id === queueId ? { ...item, status: 'success' } : item)),
            );
          } catch (error) {
            const { errorCode, details } = parseServerError(error);
            if (errorCode === 'SOURCE_DEDUP_HIT') {
              const dedupDetails = details as { existing_filename?: unknown } | null;
              const existingFilename =
                dedupDetails &&
                typeof dedupDetails.existing_filename === 'string' &&
                dedupDetails.existing_filename
                  ? dedupDetails.existing_filename
                  : file.name;
              const reuse = window.confirm(
                `检测到重复来源：${existingFilename}\n\n点击“确定”复用已有来源；点击“取消”仍创建新来源。`,
              );
              const dedupAction = reuse ? 'reuse' : 'create_new';
              try {
                // eslint-disable-next-line no-await-in-loop -- Keep per-file UI updates and dedup flow serial.
                await api.v2
                  .notebooks({ nid: activeNotebookId })
                  .sources.upload.post({ file }, { query: { dedupAction } })
                  .then((r) => {
                    // eslint-disable-next-line typescript/no-base-to-string, eslint/preserve-caught-error
                    if (r.error) throw new Error(parseServerError(r.error).message);
                  });
                successCount += 1;
                setUploadQueue((prev) =>
                  prev.map((item) =>
                    item.id === queueId
                      ? {
                          ...item,
                          status: 'success',
                          message: reuse ? '已复用已有来源' : undefined,
                        }
                      : item,
                  ),
                );
                continue;
              } catch {
                failedFiles.push(file);
                setUploadQueue((prev) =>
                  prev.map((item) =>
                    item.id === queueId ? { ...item, status: 'error', message: '上传失败' } : item,
                  ),
                );
                continue;
              }
            }
            failedFiles.push(file);
            setUploadQueue((prev) =>
              prev.map((item) =>
                item.id === queueId ? { ...item, status: 'error', message: '上传失败' } : item,
              ),
            );
          }
        }

        if (successCount > 0) {
          await mutate();
        }

        if (failedFiles.length > 0) {
          const message =
            failedFiles.length === files.length
              ? '上传失败，请检查文件格式或后端状态。'
              : `部分上传失败（${failedFiles.length}/${files.length}）。`;
          setUploadError(message);
          setLastFailedUploadFiles(failedFiles);
          toast.error(message);
        } else {
          setLastFailedUploadFiles([]);
          toast.success(`已上传 ${successCount} 个来源`);
        }
      } finally {
        store.getState().setUploadState('idle');
      }
    },
    [activeNotebookId, isConnected, mutate, store],
  );

  const retryUpload = useCallback(async () => {
    if (!lastFailedUploadFiles.length) return;
    await handleUpload(lastFailedUploadFiles);
  }, [lastFailedUploadFiles, handleUpload]);

  const clearUploadQueue = useCallback(() => {
    setUploadQueue([]);
  }, []);

  const retrySources = useCallback(async () => {
    store.getState().setError('sources', '');
    await mutate();
  }, [mutate, store]);

  const handleSearch = useCallback(
    async ({ query, engine, mode }: { query: string; engine: string; mode: string }) => {
      if (!isConnected) {
        toast.warning('未连接到后端服务，暂无法搜索。');
        return;
      }
      if (!activeNotebookId) {
        toast.warning('请先创建笔记本后搜索。');
        return;
      }
      const trimmed = query.trim();
      if (!trimmed) {
        toast.warning('请输入搜索关键词。');
        return;
      }

      searchIdRef.current += 1;
      const searchId = `search-${searchIdRef.current}-${Date.now()}`;

      const newQueueItem: SearchQueueItem = {
        id: searchId,
        query: trimmed,
        engine,
        mode,
        status: 'loading',
        results: [],
        notice: '',
        createdAt: Date.now(),
      };
      setSearchQueue((prev) => {
        const next = [...prev, newQueueItem];
        return next.length > maxSearchQueueItems ? next.slice(-maxSearchQueueItems) : next;
      });

      setSearchState('loading');

      try {
        const { data: response, error: srErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sources.search.post({ query: trimmed, engine, mode });
        if (srErr) throw new Error(parseServerError(srErr).message);
        const results = response?.results ?? [];
        let notice = '';
        if (response?.message) {
          notice = response.message;
        } else if (results.length === 0) {
          notice = '没有找到匹配结果。';
        } else {
          notice = `已找到 ${results.length} 条结果。`;
        }

        setSearchQueue((prev) =>
          prev.map((item) =>
            item.id === searchId ? { ...item, status: 'success', results, notice } : item,
          ),
        );
      } catch {
        const errorNotice = '搜索失败，请稍后重试。';
        setSearchQueue((prev) =>
          prev.map((item) =>
            item.id === searchId ? { ...item, status: 'error', notice: errorNotice } : item,
          ),
        );
      } finally {
        setSearchState('idle');
      }
    },
    [isConnected, activeNotebookId],
  );

  const removeSearchQueueItem = useCallback((queueItemId: string) => {
    setSearchQueue((prev) => prev.filter((item) => item.id !== queueItemId));
  }, []);

  const removeResultsFromQueue = useCallback((urls: string[]) => {
    const urlSet = new Set(urls);
    setSearchQueue((prev) =>
      prev
        .map((item) => ({
          ...item,
          results: item.results.filter((r) => !urlSet.has(r.url)),
        }))
        .filter((item) => item.results.length > 0 || item.status === 'loading'),
    );
  }, []);

  const removeSources = useCallback(
    async (sourceIds: number[]) => {
      if (!isConnected) {
        toast.warning('未连接到后端服务，暂不支持删除来源。');
        return false;
      }
      if (!activeNotebookId) {
        toast.warning('请先创建笔记本后再删除来源。');
        return false;
      }
      if (sourceIds.length === 0) {
        return false;
      }
      setRemoveState('loading');
      try {
        const { error: delBatchErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sources.batch.delete.post({ sourceIds });
        if (delBatchErr) throw new Error(parseServerError(delBatchErr).message);
        await mutate();
        toast.success('来源删除成功');
        return true;
      } catch {
        toast.error('删除失败，请稍后重试。');
        return false;
      } finally {
        setRemoveState('idle');
      }
    },
    [isConnected, mutate, activeNotebookId],
  );

  const removeSource = useCallback(
    async (sourceId: number) => {
      if (!isConnected) {
        toast.warning('未连接到后端服务，暂不支持删除来源。');
        return false;
      }
      if (!activeNotebookId) {
        toast.warning('请先创建笔记本后再删除来源。');
        return false;
      }
      setRemoveState('loading');
      try {
        const { error: delErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sources({ sid: sourceId })
          .delete();
        if (delErr) throw new Error(parseServerError(delErr).message);
        await mutate();
        toast.success('来源删除成功');
        return true;
      } catch {
        toast.error('删除失败，请稍后重试。');
        return false;
      } finally {
        setRemoveState('idle');
      }
    },
    [isConnected, mutate, activeNotebookId],
  );

  const handleBatchReembedSources = useCallback(
    async (sourceIds: number[]) => {
      if (!isConnected) {
        toast.warning('未连接到后端服务，暂不支持重新嵌入。');
        return false;
      }
      if (!activeNotebookId) {
        toast.warning('请先创建笔记本后再重试。');
        return false;
      }
      if (!sourceIds.length) return false;

      setBatchReembedState('loading');
      try {
        const { data: result, error: breErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sources.batch['re-embed'].post({ sourceIds });
        if (breErr) throw new Error(parseServerError(breErr).message);
        await mutate();
        if ((result?.failedCount ?? 0) > 0) {
          toast.warning(`部分来源重新嵌入失败（${result?.failedCount} 个）。`);
        } else {
          toast.success(`已重新嵌入 ${result?.reembeddedCount ?? 0} 个来源`);
        }
        return (result?.failedCount ?? 0) === 0;
      } catch {
        toast.error('批量重新嵌入失败，请稍后重试。');
        return false;
      } finally {
        setBatchReembedState('idle');
      }
    },
    [isConnected, activeNotebookId, mutate],
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

  const handleConvertOutputToSource = useCallback(
    async (outputId: number) => {
      if (!activeNotebookId) return;
      if (!isConnected) {
        toast.warning('未连接到后端服务，暂不支持此功能。');
        return;
      }
      try {
        const { data: result, error: coErr } = await api.v2
          .outputs({ id: outputId })
          // eslint-disable-next-line no-unexpected-multiline
          ['convert-to-source'].post(undefined, {
            query: { notebookId: activeNotebookId },
          });
        if (coErr) throw new Error(parseServerError(coErr).message);
        await mutate();
        toast.success(`已转换为来源：${result?.filename}（${result?.chunkCount} 个分块）`);
      } catch (error) {
        const message = error instanceof Error ? error.message : '转换失败';
        toast.error(`转换失败：${message}`);
      }
    },
    [activeNotebookId, isConnected, mutate],
  );

  const handleAddSourceFromUrl = useCallback(
    async (
      url: string,
      mode: SourceFromUrlMode,
      options?: { title?: string; snippet?: string; extractor?: ExtractorType },
    ) => {
      if (!isConnected) {
        throw new Error('未连接到后端服务，暂不支持此功能');
      }
      if (!activeNotebookId) {
        throw new Error('请先创建笔记本');
      }
      const call = async (dedupAction?: 'reuse' | 'create_new') => {
        // Zod transform makes `extractor` required on the Eden body type (output shape).
        const body = {
          url,
          mode,
          title: options?.title,
          snippet: options?.snippet,
          extractor: options?.extractor ?? null,
        };
        const request = (async () => {
          const r = dedupAction
            ? await api.v2
                .notebooks({ nid: activeNotebookId })
                .sources['from-url'].post(body, { query: { dedupAction } })
            : await api.v2.notebooks({ nid: activeNotebookId }).sources['from-url'].post(body);
          if (r.error) throw new Error(parseServerError(r.error).message);
          return r.data;
        })();
        if (mode === 'fetch') {
          return withTimeout(
            request,
            SOURCE_FROM_URL_FETCH_TIMEOUT_MS,
            '获取网页内容超时（约 2 分钟）。请检查网络或稍后重试，也可先使用「保存链接」。',
          );
        }
        return request;
      };

      try {
        const result = await call();
        await mutate();
        return result;
      } catch (error) {
        const { errorCode, details } = parseServerError(error);
        if (errorCode !== 'SOURCE_DEDUP_HIT') {
          throw error;
        }
        const dedupDetails = details as { existing_filename?: unknown } | null;
        const existingFilename =
          dedupDetails &&
          typeof dedupDetails.existing_filename === 'string' &&
          dedupDetails.existing_filename
            ? dedupDetails.existing_filename
            : url;
        const reuse = window.confirm(
          `检测到重复来源：${existingFilename}\n\n点击“确定”复用已有来源；点击“取消”仍创建新来源。`,
        );
        const result = await call(reuse ? 'reuse' : 'create_new');
        await mutate();
        if (reuse) toast.info('已复用已有来源');
        return result;
      }
    },
    [isConnected, activeNotebookId, mutate],
  );

  const {
    data: extractorsData,
    isLoading: extractorsLoading,
    mutate: mutateExtractors,
  } = useSWR<ExtractorsListResponse>(
    activeNotebookId && isConnected ? ['workspace/extractors', activeNotebookId] : null,
    () =>
      api.v2
        .notebooks({ nid: activeNotebookId! })
        .extractors.get()
        .then((r) => {
          // eslint-disable-next-line typescript/no-base-to-string
          if (r.error) throw new Error(parseServerError(r.error).message);
          if (!r.data) throw new Error('加载提取器失败');
          return r.data;
        }),
    { revalidateOnFocus: false },
  );

  const extractors = useMemo<ExtractorInfo[]>(() => {
    return extractorsData?.extractors ?? [];
  }, [extractorsData]);

  const availableExtractors = useMemo<ExtractorInfo[]>(() => {
    return extractors.filter((e) => e.enabled && e.available);
  }, [extractors]);

  const defaultExtractor = useMemo<ExtractorType | null>(() => {
    return extractorsData?.defaultExtractor ?? null;
  }, [extractorsData]);

  const extractorsPolicy = useMemo<NotebookExtractorsPolicy | null>(() => {
    const policy = extractorsData?.policy;
    if (!policy) return null;
    return {
      mode: policy.mode,
      enabledExtractors: policy.enabledExtractors ?? undefined,
    };
  }, [extractorsData]);

  const extractorFallbackEnabled = useMemo<boolean | null>(() => {
    if (typeof extractorsData?.fallbackEnabled === 'boolean') return extractorsData.fallbackEnabled;
    return null;
  }, [extractorsData]);

  const handlePatchExtractorsPolicy = useCallback(
    async (patch: PatchNotebookExtractorsPolicyRequest) => {
      if (!isConnected) {
        throw new Error('未连接到后端服务，暂不支持此功能');
      }
      if (!activeNotebookId) {
        throw new Error('请先创建笔记本');
      }
      const { error: peErr } = await api.v2
        .notebooks({ nid: activeNotebookId })
        .extractors.patch(patch);
      if (peErr) throw new Error(parseServerError(peErr).message);
      await mutateExtractors();
    },
    [activeNotebookId, isConnected, mutateExtractors],
  );

  const refreshExtractors = useCallback(async () => {
    await mutateExtractors();
  }, [mutateExtractors]);

  const sourceTags = useMemo<SourceTagRead[]>(() => tagsData ?? [], [tagsData]);

  const handleConvertSourceQAToSource = useCallback(
    async (sourceId: number, messages: QaMessage[]) => {
      if (!isConnected) {
        throw new Error('未连接到后端服务，暂不支持此功能');
      }
      if (!activeNotebookId) {
        throw new Error('请先创建笔记本');
      }
      const { data: result, error: csErr } = await api.v2
        .notebooks({ nid: activeNotebookId })
        .sources({ sid: sourceId })
        // eslint-disable-next-line no-unexpected-multiline
        ['qa-to-source'].post({ messages });
      if (csErr) throw new Error(parseServerError(csErr).message);
      await mutate();
      return result;
    },
    [isConnected, activeNotebookId, mutate],
  );

  const handleReembedSource = useCallback(
    async (sourceId: number) => {
      if (!isConnected) {
        toast.error('未连接到后端服务，无法重新嵌入。');
        return;
      }
      if (!activeNotebookId) {
        toast.error('请先创建笔记本。');
        return;
      }
      try {
        const { error: reErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sources({ sid: sourceId })
          // eslint-disable-next-line no-unexpected-multiline
          ['re-embed'].post();
        if (reErr) throw new Error(parseServerError(reErr).message);
        toast.success('已重新嵌入来源');
        await mutate();
      } catch (error) {
        const message = error instanceof Error ? error.message : '重新嵌入失败';
        toast.error(message);
      }
    },
    [isConnected, mutate, activeNotebookId],
  );

  return {
    sources,
    citations,
    hoveredCitationChunkId,
    hoveredMessageChunkIds,
    jumpToCitationChunkId,
    uploadState: uploadStateCurrent,
    uploadError,
    uploadQueue,
    isLoading: loadingSources,
    highlightedChunkIds,
    setHoveredCitationChunkId,
    setHoveredMessageChunkIds,
    setJumpToCitationChunkId,
    handleUpload,
    retryUpload,
    clearUploadQueue,
    retrySources,
    searchState,
    handleSearch,
    removeSources,
    removeSource,
    removeState,
    convertOutputToSource: handleConvertOutputToSource,
    addSourceFromUrl: handleAddSourceFromUrl,
    isConnected,
    searchQueue,
    removeSearchQueueItem,
    removeResultsFromQueue,
    extractors,
    availableExtractors,
    defaultExtractor,
    extractorsLoading,
    extractorsPolicy,
    extractorFallbackEnabled,
    patchExtractorsPolicy: handlePatchExtractorsPolicy,
    refreshExtractors,
    convertSourceQAToSource: handleConvertSourceQAToSource,
    reembedSource: handleReembedSource,
    batchReembedSources: handleBatchReembedSources,
    batchReembedState,
    sourceTags,
    tagMutationState,
    createSourceTag: handleCreateSourceTag,
    renameSourceTag: handleRenameSourceTag,
    deleteSourceTag: handleDeleteSourceTag,
    assignTagToSources: handleAssignTagToSources,
    removeTagFromSources: handleRemoveTagFromSources,
    sortBy,
    sortOrder,
    tagFilter,
    setSortBy,
    setSortOrder,
    setTagFilter,
  };
}
