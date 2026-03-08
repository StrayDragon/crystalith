import { useEffect } from "react";

import { useResearch } from "../research/useResearch";

import SourcesPanelView, { type SourcesPanelProps } from "./components/SourcesPanelView";

export default function SourcesPanel(props: SourcesPanelProps) {
  const { notebookId } = props;
  const research = useResearch(notebookId);
  const { fetchSessions, subscribeToSSE, unsubscribeFromSSE, activeSession } = research;

  useEffect(() => {
    if (notebookId) {
      fetchSessions();
    }
  }, [notebookId, fetchSessions]);

  useEffect(() => {
    const session = activeSession;
    if (!session) return;
    if (["planning", "searching", "analyzing", "waiting_user"].includes(session.status)) {
      subscribeToSSE(session.id);
      return () => unsubscribeFromSSE();
    }
    unsubscribeFromSSE();
  }, [activeSession?.id, activeSession?.status, subscribeToSSE, unsubscribeFromSSE]);

  return <SourcesPanelView {...props} research={research} />;
}
