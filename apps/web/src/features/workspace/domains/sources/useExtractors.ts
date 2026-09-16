import type {
  ExtractorInfo,
  ExtractorsList,
  NotebookExtractorsPolicyView,
  PatchNotebookExtractorPolicy,
} from '@crystalith/shared';
import { useCallback, useMemo } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';
import { parseServerError } from '../../../../api/parseServerError';
import type { SourceSeamContext } from './sourceSeamContext';

type ExtractorType = ExtractorInfo['type'];
type NotebookExtractorsPolicy = NotebookExtractorsPolicyView;
type PatchNotebookExtractorsPolicyRequest = PatchNotebookExtractorPolicy;
type ExtractorsListResponse = ExtractorsList;

/** Extractor availability + policy seam (W6). */
export function useExtractors(ctx: SourceSeamContext) {
  const { activeNotebookId, isConnected } = ctx;

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

  return {
    extractors,
    availableExtractors,
    defaultExtractor,
    extractorsLoading,
    extractorsPolicy,
    extractorFallbackEnabled,
    patchExtractorsPolicy: handlePatchExtractorsPolicy,
    refreshExtractors,
  };
}
