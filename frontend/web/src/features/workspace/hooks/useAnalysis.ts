import { useCallback, useEffect, useState } from 'react';

import { analyzeNotebook, type ApiAnalysis } from '../api';
import { useWorkspaceState } from '../context/WorkspaceContext';

interface AnalysisState {
  analysis: ApiAnalysis | null;
  isLoading: boolean;
  error: string;
}

export function useAnalysis() {
  const state = useWorkspaceState();
  const isDemo = state.connectionState === 'demo';
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    analysis: null,
    isLoading: false,
    error: '',
  });

  // Clear analysis when notebook changes
  useEffect(() => {
    setAnalysisState({ analysis: null, isLoading: false, error: '' });
  }, [state.activeNotebookId]);

  const fetchAnalysis = useCallback(async () => {
    if (!state.activeNotebookId) {
      setAnalysisState((prev) => ({
        ...prev,
        error: '请先选择笔记本。',
      }));
      return null;
    }

    if (isDemo) {
      // Return demo analysis data
      const demoAnalysis: ApiAnalysis = {
        notebook_id: state.activeNotebookId,
        source_count: state.sources.length,
        chunk_count: state.sources.reduce((sum, s) => sum + s.chunks, 0),
        session_count: state.sessions.length,
        output_count: state.outputs.length,
        topics: ['产品调研', '竞品分析', '用户需求'],
        summary: '这是一个演示笔记本，包含产品调研相关的资料和分析。',
        created_at: new Date().toISOString(),
      };
      setAnalysisState({
        analysis: demoAnalysis,
        isLoading: false,
        error: '',
      });
      return demoAnalysis;
    }

    setAnalysisState((prev) => ({ ...prev, isLoading: true, error: '' }));
    try {
      const analysis = await analyzeNotebook(state.activeNotebookId);
      setAnalysisState({ analysis, isLoading: false, error: '' });
      return analysis;
    } catch (error) {
      setAnalysisState((prev) => ({
        ...prev,
        isLoading: false,
        error: '分析失败，请稍后重试。',
      }));
      return null;
    }
  }, [isDemo, state.activeNotebookId, state.outputs.length, state.sessions.length, state.sources]);

  const clearAnalysis = useCallback(() => {
    setAnalysisState({ analysis: null, isLoading: false, error: '' });
  }, []);

  return {
    analysis: analysisState.analysis,
    isLoading: analysisState.isLoading,
    error: analysisState.error,
    fetchAnalysis,
    clearAnalysis,
    isDemo,
  };
}
