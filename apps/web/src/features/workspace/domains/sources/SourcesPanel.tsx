import { useEffect } from 'react';

import { useResearch } from '../research/useResearch';
import SourcesPanelView, { type SourcesPanelProps } from './components/SourcesPanelView';

export default function SourcesPanel(props: SourcesPanelProps) {
  const { notebookId } = props;
  const research = useResearch(notebookId);
  const { fetchSessions, subscribeToSSE, unsubscribeFromSSE, activeSession } = research;
  const activeSessionId = activeSession?.id;
  const activeSessionStatus = activeSession?.status;

  useEffect(() => {
    if (notebookId) {
      void fetchSessions();
    }
  }, [notebookId, fetchSessions]);

  useEffect(() => {
    if (!activeSessionId || !activeSessionStatus) return;
    if (['planning', 'searching', 'analyzing', 'waiting_user'].includes(activeSessionStatus)) {
      subscribeToSSE(activeSessionId);
      return () => unsubscribeFromSSE();
    }
    unsubscribeFromSSE();
  }, [activeSessionId, activeSessionStatus, subscribeToSSE, unsubscribeFromSSE]);

  return <SourcesPanelView {...props} research={research} />;
}
