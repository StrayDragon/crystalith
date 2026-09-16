import type { SourceFromUrlMode } from '@crystalith/shared';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../../../../api/eden';
import { parseServerError } from '../../../../api/parseServerError';
import { toast } from '../../../../shared/toast';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import type { SourceSeamContext } from './sourceSeamContext';

type ExtractorType = import('@crystalith/shared').ExtractorInfo['type'];

/** W5: pending dedup "reuse or create new" decision (rendered as a dialog). */
export interface DedupConfirmRequest {
  existingName: string;
  resolve: (reuse: boolean) => void;
}

export interface SourceUploadItem {
  id: string;
  name: string;
  status: 'queued' | 'uploading' | 'success' | 'error';
  message?: string;
}

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

async function uploadSourceFile(
  notebookId: number,
  file: File,
  dedupAction: 'prompt' | 'reuse' | 'create_new',
): Promise<void> {
  const r = await api.v2
    .notebooks({ nid: notebookId })
    // Eden treats Zod .default() query fields as required on the client.
    .sources.upload.post({ file }, { query: { dedupAction } });
  if (r.error) throw new Error(parseServerError(r.error).message);
}

/** File upload + URL import seam (W6), incl. the dedup confirm handshake. */
export function useSourceUploads(ctx: SourceSeamContext) {
  const { activeNotebookId, isConnected, mutate } = ctx;
  const uploadStateCurrent = useWorkspaceStore((s) => s.uploadState);
  const store = useWorkspaceStore;
  const [uploadError, setUploadError] = useState('');
  const [lastFailedUploadFiles, setLastFailedUploadFiles] = useState<File[]>([]);
  const [uploadQueue, setUploadQueue] = useState<SourceUploadItem[]>([]);
  // W5: dedup "reuse existing source?" runs through an in-app dialog rendered
  // by SourceDedupConfirmDialog instead of window.confirm.
  const [dedupConfirm, setDedupConfirm] = useState<DedupConfirmRequest | null>(null);

  const askDedupReuse = useCallback(
    (existingName: string) =>
      new Promise<boolean>((resolve) => {
        setDedupConfirm({ existingName, resolve });
      }),
    [],
  );

  const resolveDedupConfirm = useCallback((reuse: boolean) => {
    setDedupConfirm((prev) => {
      prev?.resolve(reuse);
      return null;
    });
  }, []);

  useEffect(() => {
    setUploadError('');
    setLastFailedUploadFiles([]);
    setUploadQueue([]);
  }, [activeNotebookId]);

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
            // Upload queue + dedup confirmation requires serial execution.
            await uploadSourceFile(activeNotebookId, file, 'prompt');
            successCount += 1;
            setUploadQueue((prev) =>
              prev.map((item) => (item.id === queueId ? { ...item, status: 'success' } : item)),
            );
          } catch (error) {
            const { errorCode, details } = parseServerError(error);
            if (errorCode === 'SOURCE_DEDUP_HIT') {
              const existingFilename =
                details &&
                typeof details.existing_filename === 'string' &&
                details.existing_filename
                  ? details.existing_filename
                  : file.name;
              const reuse = await askDedupReuse(existingFilename);
              const dedupAction = reuse ? 'reuse' : 'create_new';
              try {
                // Keep per-file UI updates and dedup flow serial.
                await uploadSourceFile(activeNotebookId, file, dedupAction);
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
    [askDedupReuse, activeNotebookId, isConnected, mutate, store],
  );

  const retryUpload = useCallback(async () => {
    if (!lastFailedUploadFiles.length) return;
    await handleUpload(lastFailedUploadFiles);
  }, [lastFailedUploadFiles, handleUpload]);

  const clearUploadQueue = useCallback(() => {
    setUploadQueue([]);
  }, []);

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
        const dedupDetails = details;
        const existingFilename =
          dedupDetails &&
          typeof dedupDetails.existing_filename === 'string' &&
          dedupDetails.existing_filename
            ? dedupDetails.existing_filename
            : url;
        const reuse = await askDedupReuse(existingFilename);
        const result = await call(reuse ? 'reuse' : 'create_new');
        await mutate();
        if (reuse) toast.info('已复用已有来源');
        return result;
      }
    },
    [askDedupReuse, isConnected, activeNotebookId, mutate],
  );

  return {
    uploadState: uploadStateCurrent,
    uploadError,
    uploadQueue,
    handleUpload,
    retryUpload,
    clearUploadQueue,
    addSourceFromUrl: handleAddSourceFromUrl,
    dedupConfirm,
    resolveDedupConfirm,
  };
}
