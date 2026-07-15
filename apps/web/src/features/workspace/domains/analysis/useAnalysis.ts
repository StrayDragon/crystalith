import { useCallback, useEffect, useState } from 'react';

import { api } from '../../../../api/eden';
import type { AnalysisResult } from '../../../../api/shared-types';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';

interface AnalysisState {
  analysis: AnalysisResult | null;
  isLoading: boolean;
  error: string;
}

export function useAnalysis() {
  const activeNotebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const connectionState = useWorkspaceStore((s) => s.connectionState);
  const isConnected = connectionState === 'live';

  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    analysis: null,
    isLoading: false,
    error: '',
  });

  // Clear analysis when notebook changes
  useEffect(() => {
    setAnalysisState({ analysis: null, isLoading: false, error: '' });
  }, [activeNotebookId]);

  const fetchAnalysis = useCallback(async () => {
    if (!activeNotebookId) {
      setAnalysisState((prev) => ({
        ...prev,
        error: '请先选择笔记本。',
      }));
      return null;
    }
    if (!isConnected) {
      setAnalysisState((prev) => ({
        ...prev,
        error: '未连接到后端服务，无法分析。',
      }));
      return null;
    }

    setAnalysisState((prev) => ({ ...prev, isLoading: true, error: '' }));
    try {
      const { data, error } = await api.v2.analysis.post({
        notebook_id: activeNotebookId,
      });
      if (error) throw error;
      const analysis = (data ?? null) as AnalysisResult | null;
      setAnalysisState({
        analysis,
        isLoading: false,
        error: '',
      });
      return analysis;
    } catch {
      setAnalysisState((prev) => ({
        ...prev,
        isLoading: false,
        error: '分析失败，请稍后重试。',
      }));
      return null;
    }
  }, [isConnected, activeNotebookId]);

  const clearAnalysis = useCallback(() => {
    setAnalysisState({ analysis: null, isLoading: false, error: '' });
  }, []);

  return {
    analysis: analysisState.analysis,
    isLoading: analysisState.isLoading,
    error: analysisState.error,
    fetchAnalysis,
    clearAnalysis,
    isConnected,
  };
}
