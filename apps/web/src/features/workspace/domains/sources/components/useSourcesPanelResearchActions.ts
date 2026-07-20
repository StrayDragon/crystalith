import { useCallback, useRef, useState } from 'react';

import { t } from '../../../../../shared/i18n';
import { toast } from '../../../../../shared/toast';
import type { ResearchPlanConfirmPayload } from '../../research/ResearchDetailPanel';
import type { Research } from './sources-panel-types';

export function useSourcesPanelResearchActions({ research }: { research: Research }) {
  const researchModalRef = useRef<HTMLDivElement | null>(null);
  const [researchDetailOpen, setResearchDetailOpen] = useState(false);
  const [researchFullscreen, setResearchFullscreen] = useState(true);
  const [showResearchHistory, setShowResearchHistory] = useState(false);

  const handleResearchClick = useCallback(
    async (sessionId: number) => {
      research.unsubscribeFromSSE();
      research.clearEvents();
      const session = await research.fetchSession(sessionId);
      if (!session) {
        toast.error(t('sources.research.detail_fetch_failed'));
        return;
      }
      setResearchDetailOpen(true);
    },
    [research],
  );

  const handleResearchStart = useCallback(
    async (sessionId: number) => {
      await research.startResearch(sessionId);
    },
    [research],
  );

  const handleResearchDelete = useCallback(
    async (sessionId: number) => {
      await research.deleteSession(sessionId);
    },
    [research],
  );

  const handleResearchApprove = useCallback(
    async (payload: ResearchPlanConfirmPayload) => {
      const session = research.activeSession;
      if (!session?.id) return;
      if (payload.allSelected) {
        await research.approveSearchPlan(session.id);
        return;
      }
      await research.modifySearchPlan(session.id, {
        iteration: session.currentIteration,
        queries: payload.queries,
        reasoning: payload.reasoning,
        estimatedResults: 10,
      });
    },
    [research],
  );

  const handleResearchSkip = useCallback(async () => {
    if (research.activeSession?.id) {
      await research.skipIteration(research.activeSession.id);
    }
  }, [research]);

  const handleResearchFinish = useCallback(async () => {
    if (research.activeSession?.id) {
      await research.finishResearch(research.activeSession.id);
    }
  }, [research]);

  const handleResearchCancel = useCallback(async () => {
    if (research.activeSession?.id) {
      await research.cancelResearch(research.activeSession.id);
      setResearchDetailOpen(false);
    }
  }, [research]);

  const handleResearchResume = useCallback(async () => {
    if (!research.activeSession?.id) return;
    research.unsubscribeFromSSE();
    research.clearEvents();
    const resumed = await research.resumeResearch(research.activeSession.id);
    if (!resumed) {
      toast.error(t('sources.research.resume_failed'));
    }
  }, [research]);

  const handleResearchRetry = useCallback(async () => {
    if (!research.activeSession) return;
    research.unsubscribeFromSSE();
    research.clearEvents();
    const session = await research.createSession(
      research.activeSession.topic,
      research.activeSession.maxIterations,
    );
    if (session) {
      await research.startResearch(session.id);
      setResearchDetailOpen(true);
    }
  }, [research]);

  const handleCloseResearchDetail = useCallback(() => {
    setResearchDetailOpen(false);
    if (research.activeSession?.id) {
      void research.fetchSession(research.activeSession.id);
    }
  }, [research]);

  return {
    researchModalRef,
    researchDetailOpen,
    researchFullscreen,
    showResearchHistory,
    setShowResearchHistory,
    setResearchFullscreen,
    handleResearchClick,
    handleResearchStart,
    handleResearchDelete,
    handleResearchApprove,
    handleResearchSkip,
    handleResearchFinish,
    handleResearchCancel,
    handleResearchResume,
    handleResearchRetry,
    handleCloseResearchDetail,
  };
}
