import { useCallback, useEffect, useState } from 'react';

import { analyzeNotebook, type AnalysisResult } from '../api';
import { useWorkspaceState } from '../context/WorkspaceContext';

interface AnalysisState {
  analysis: AnalysisResult | null;
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
      const demoAnalysis: AnalysisResult = {
        topics: [
          {
            id: 'topic-1',
            name: '产品调研 / 用户需求',
            chunk_ids: [1, 2, 3],
            keywords: ['产品', '调研', '用户', '需求', '分析'],
          },
          {
            id: 'topic-2',
            name: '竞品分析 / 市场',
            chunk_ids: [4, 5],
            keywords: ['竞品', '分析', '市场', '对比'],
          },
        ],
        relations: [
          { source_chunk_id: 1, target_chunk_id: 4, relation_type: 'similar', score: 0.85 },
          { source_chunk_id: 2, target_chunk_id: 5, relation_type: 'similar', score: 0.72 },
        ],
        contradictions: [],
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
  }, [isDemo, state.activeNotebookId]);

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
