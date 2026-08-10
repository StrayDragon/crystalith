import { useCallback, useEffect, useRef, useState } from 'react';

import { t } from '../../../../../shared/i18n';
import type { SlideDraft, SlideStage } from '../../../shared/types';
import { consumeSlidesStageStream } from './consumeSlidesStageStream';
import { formatSlidesStageProgressMessage } from './slidesStudioUtils';
import type { SlidesGenerationEvent } from './types';

export function useSlidesStageGeneration({
  notebookId,
  isConnected,
  draft,
  saveInputStage,
  refreshDraft,
  handleSaveOutline,
  onOutputsUpdated,
  setActiveStage,
  setError,
}: {
  notebookId: number | null;
  isConnected: boolean;
  draft: SlideDraft | null;
  saveInputStage: () => Promise<SlideDraft | null>;
  refreshDraft: (slideId?: number) => Promise<void>;
  handleSaveOutline: () => Promise<void>;
  onOutputsUpdated: () => void;
  setActiveStage: (stage: SlideStage) => void;
  setError: (message: string) => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [events, setEvents] = useState<SlidesGenerationEvent[]>([]);
  const [debugTimings, setDebugTimings] = useState<Record<string, number> | null>(null);
  const generateAbortRef = useRef<AbortController | null>(null);

  const closeGenerate = useCallback(() => {
    if (generateAbortRef.current) {
      generateAbortRef.current.abort();
      generateAbortRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      closeGenerate();
    },
    [closeGenerate],
  );

  const resetGenerationState = useCallback(() => {
    setIsGenerating(false);
    setEvents([]);
  }, []);

  const runGenerateStage = useCallback(
    async (
      slideId: number,
      stage: 'outline' | 'markdown',
      handlers: { onDone?: () => Promise<void> | void; onError?: () => Promise<void> | void } = {},
    ) => {
      closeGenerate();
      setIsGenerating(true);
      setEvents([]);
      setDebugTimings(null);
      setError('');
      const ac = new AbortController();
      generateAbortRef.current = ac;

      try {
        if (!notebookId) return;
        // c70: drive generation via GET SSE (progress + done), not POST sync.
        await consumeSlidesStageStream(notebookId, slideId, stage, {
          signal: ac.signal,
          onEvent: (event) => {
            if (event.event === 'progress' || event.event === 'toolcall') {
              const message = formatSlidesStageProgressMessage(event);
              setEvents((prev) => [...prev, { type: event.event, message }]);
            }
          },
        });
        setIsGenerating(false);
        generateAbortRef.current = null;
        if (handlers.onDone) await handlers.onDone();
      } catch (error) {
        setIsGenerating(false);
        generateAbortRef.current = null;
        if (error instanceof Error && error.name === 'AbortError') return;
        setError(error instanceof Error ? error.message : '生成失败，请稍后重试。');
        if (handlers.onError) await handlers.onError();
      }
    },
    [closeGenerate, notebookId, setError],
  );

  const handleGenerateOutline = useCallback(async () => {
    if (!notebookId) return;
    if (!isConnected) {
      setError(t('studio.slides.connection_required'));
      return;
    }
    const saved = await saveInputStage();
    if (!saved) return;
    await runGenerateStage(saved.id, 'outline', {
      onDone: async () => {
        await refreshDraft(saved.id);
        setActiveStage('outline');
      },
    });
  }, [
    isConnected,
    notebookId,
    refreshDraft,
    runGenerateStage,
    saveInputStage,
    setActiveStage,
    setError,
  ]);

  const handleGenerateMarkdown = useCallback(async () => {
    if (!notebookId || !draft) return;
    if (!isConnected) {
      setError(t('studio.slides.connection_required'));
      return;
    }
    if (!draft.sourceIds || draft.sourceIds.length === 0) {
      setError(t('studio.slides.require_sources'));
      return;
    }
    await handleSaveOutline();
    await runGenerateStage(draft.id, 'markdown', {
      onDone: async () => {
        await refreshDraft(draft.id);
        setActiveStage('markdown');
        onOutputsUpdated();
      },
    });
  }, [
    draft,
    handleSaveOutline,
    isConnected,
    notebookId,
    onOutputsUpdated,
    refreshDraft,
    runGenerateStage,
    setActiveStage,
    setError,
  ]);

  const handleGenerateAll = useCallback(async () => {
    if (!notebookId) return;
    if (!isConnected) {
      setError(t('studio.slides.connection_required'));
      return;
    }
    const saved = await saveInputStage();
    if (!saved) return;
    await runGenerateStage(saved.id, 'outline', {
      onDone: async () => {
        await refreshDraft(saved.id);
        await runGenerateStage(saved.id, 'markdown', {
          onDone: async () => {
            await refreshDraft(saved.id);
            setActiveStage('markdown');
            onOutputsUpdated();
          },
        });
      },
    });
  }, [
    isConnected,
    notebookId,
    onOutputsUpdated,
    refreshDraft,
    runGenerateStage,
    saveInputStage,
    setActiveStage,
    setError,
  ]);

  return {
    isGenerating,
    setIsGenerating,
    events,
    debugTimings,
    closeGenerate,
    resetGenerationState,
    handleGenerateOutline,
    handleGenerateMarkdown,
    handleGenerateAll,
  };
}
