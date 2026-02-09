import { useEffect } from 'react';

import { useResearch } from '../research/useResearch';

import SourcesPanelView, { type SourcesPanelProps } from './components/SourcesPanelView';

export default function SourcesPanel(props: SourcesPanelProps) {
  const { notebookId } = props;
  const research = useResearch(notebookId);

  useEffect(() => {
    if (notebookId) {
      research.fetchSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId]);

  useEffect(() => {
    const session = research.activeSession;
    if (!session) return;
    if (['planning', 'searching', 'analyzing', 'waiting_user'].includes(session.status)) {
      research.subscribeToSSE(session.id);
      return () => research.unsubscribeFromSSE();
    }
    research.unsubscribeFromSSE();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [research.activeSession?.id, research.activeSession?.status]);

  return <SourcesPanelView {...props} research={research} />;
}
