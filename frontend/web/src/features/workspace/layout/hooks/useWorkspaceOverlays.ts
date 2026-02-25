import { useCallback, useState } from 'react';

import type { Citation, SourceItem } from '../../shared/types';
import { useGraphSessionDetail, type GraphSessionTarget } from './useGraphSessionDetail';

type SlideOpenMode = 'config' | 'preview';

interface UseWorkspaceOverlaysOptions {
  activeNotebookId: number | null;
  resolveSlideDraftId: (outputId: number) => number | null;
  fetchAnalysisIfNeeded: () => void;
}

export function useWorkspaceOverlays({
  activeNotebookId,
  resolveSlideDraftId,
  fetchAnalysisIfNeeded,
}: UseWorkspaceOverlaysOptions) {
  const graphSessionDetail = useGraphSessionDetail();

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [isSessionSwitcherOpen, setIsSessionSwitcherOpen] = useState(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);
  const [viewerOutputId, setViewerOutputId] = useState<number | null>(null);
  const [isViewerElevated, setIsViewerElevated] = useState(false);
  const [isGraphViewOpen, setIsGraphViewOpen] = useState(false);
  const [graphSourceDetailOpen, setGraphSourceDetailOpen] = useState(false);
  const [graphSelectedSource, setGraphSelectedSource] = useState<SourceItem | null>(null);
  const [graphSourceDetailFullscreen, setGraphSourceDetailFullscreen] = useState(false);
  const [citationSourceDetailOpen, setCitationSourceDetailOpen] = useState(false);
  const [citationSelectedSource, setCitationSelectedSource] = useState<SourceItem | null>(null);
  const [citationSourceDetailFullscreen, setCitationSourceDetailFullscreen] = useState(false);
  const [jumpToSource, setJumpToSource] = useState<{ id: number; token: number } | null>(null);
  const [isSlidesDialogOpen, setIsSlidesDialogOpen] = useState(false);
  const [slidesOpenMode, setSlidesOpenMode] = useState<SlideOpenMode>('config');
  const [slidesDraftId, setSlidesDraftId] = useState<number | null>(null);
  const [slidesQueueJobId, setSlidesQueueJobId] = useState<string | null>(null);

  const closeCommandPalette = useCallback(() => {
    setShowCommandPalette(false);
  }, []);

  const closeCatalog = useCallback(() => {
    setShowCatalog(false);
  }, []);

  const openShortcutHelp = useCallback(() => {
    setIsShortcutHelpOpen(true);
  }, []);

  const closeShortcutHelp = useCallback(() => {
    setIsShortcutHelpOpen(false);
  }, []);

  const openSessionSwitcher = useCallback(() => {
    setIsSessionSwitcherOpen(true);
  }, []);

  const closeSessionSwitcher = useCallback(() => {
    setIsSessionSwitcherOpen(false);
  }, []);

  const toggleSessionSwitcher = useCallback(() => {
    setIsSessionSwitcherOpen((prev) => !prev);
  }, []);

  const closeOutputViewer = useCallback(() => {
    setIsViewerOpen(false);
    setIsViewerFullscreen(false);
  }, []);

  const toggleOutputViewer = useCallback(() => {
    setIsViewerFullscreen((prev) => !prev);
  }, []);

  const closeSlidesDialog = useCallback(() => {
    setIsSlidesDialogOpen(false);
    setSlidesOpenMode('config');
    setSlidesDraftId(null);
    setSlidesQueueJobId(null);
  }, []);

  const openSlidesDialog = useCallback(
    (mode: SlideOpenMode, slideId?: number | null, queueJobId?: string | null) => {
      setSlidesOpenMode(mode);
      setSlidesDraftId(slideId ?? null);
      setSlidesQueueJobId(queueJobId ?? null);
      setIsSlidesDialogOpen(true);
      setIsViewerOpen(false);
      setViewerOutputId(null);
      setIsViewerFullscreen(false);
      setIsViewerElevated(false);
    },
    [],
  );

  const openOutputViewer = useCallback(
    (outputId: number, elevated = false) => {
      const slideId = resolveSlideDraftId(outputId);
      if (slideId) {
        openSlidesDialog('preview', slideId);
        return;
      }
      setViewerOutputId(outputId);
      setIsViewerOpen(true);
      setIsViewerFullscreen(false);
      setIsViewerElevated(elevated);
    },
    [openSlidesDialog, resolveSlideDraftId],
  );

  const openOutputViewerFullscreen = useCallback(
    (outputId: number) => {
      const slideId = resolveSlideDraftId(outputId);
      if (slideId) {
        openSlidesDialog('preview', slideId);
        return;
      }
      setViewerOutputId(outputId);
      setIsViewerOpen(true);
      setIsViewerFullscreen(true);
      setIsViewerElevated(false);
    },
    [openSlidesDialog, resolveSlideDraftId],
  );

  const selectOutput = useCallback(
    (outputId: number) => {
      const slideId = resolveSlideDraftId(outputId);
      if (slideId) {
        openSlidesDialog('preview', slideId);
        return;
      }
      setViewerOutputId(outputId);
    },
    [openSlidesDialog, resolveSlideDraftId],
  );

  const openGraphView = useCallback(() => {
    setIsGraphViewOpen(true);
    fetchAnalysisIfNeeded();
  }, [fetchAnalysisIfNeeded]);

  const closeGraphView = useCallback(() => {
    setIsGraphViewOpen(false);
  }, []);

  const openGraphSourceDetail = useCallback((source: SourceItem) => {
    setGraphSelectedSource(source);
    setGraphSourceDetailOpen(true);
    setGraphSourceDetailFullscreen(false);
  }, []);

  const closeGraphSourceDetail = useCallback(() => {
    setGraphSourceDetailOpen(false);
    setGraphSourceDetailFullscreen(false);
  }, []);

  const toggleGraphSourceDetailFullscreen = useCallback(() => {
    setGraphSourceDetailFullscreen((prev) => !prev);
  }, []);

  const openCitationSourceDetail = useCallback((source: SourceItem) => {
    setCitationSelectedSource(source);
    setCitationSourceDetailOpen(true);
    setCitationSourceDetailFullscreen(false);
  }, []);

  const closeCitationSourceDetail = useCallback(() => {
    setCitationSourceDetailOpen(false);
    setCitationSelectedSource(null);
    setCitationSourceDetailFullscreen(false);
  }, []);

  const toggleCitationSourceDetailFullscreen = useCallback(() => {
    setCitationSourceDetailFullscreen((prev) => !prev);
  }, []);

  const locateCitationSource = useCallback((sourceId: number) => {
    setJumpToSource((prev) => ({
      id: sourceId,
      token: (prev?.token ?? 0) + 1,
    }));
  }, []);

  const openGraphSessionDetail = useCallback(
    async (session: GraphSessionTarget) => {
      await graphSessionDetail.openSessionDetail(session, activeNotebookId);
    },
    [activeNotebookId, graphSessionDetail],
  );

  const closeActiveOverlay = useCallback(() => {
    if (showCommandPalette) {
      closeCommandPalette();
      return true;
    }
    if (showCatalog) {
      closeCatalog();
      return true;
    }
    if (isShortcutHelpOpen) {
      closeShortcutHelp();
      return true;
    }
    if (graphSessionDetail.isOpen) {
      graphSessionDetail.closeSessionDetail();
      return true;
    }
    if (citationSourceDetailOpen) {
      closeCitationSourceDetail();
      return true;
    }
    if (graphSourceDetailOpen) {
      closeGraphSourceDetail();
      return true;
    }
    if (isSlidesDialogOpen) {
      closeSlidesDialog();
      return true;
    }
    if (isViewerOpen) {
      closeOutputViewer();
      return true;
    }
    if (isGraphViewOpen) {
      closeGraphView();
      return true;
    }
    if (isSessionSwitcherOpen) {
      closeSessionSwitcher();
      return true;
    }
    return false;
  }, [
    showCommandPalette,
    closeCommandPalette,
    showCatalog,
    closeCatalog,
    isShortcutHelpOpen,
    closeShortcutHelp,
    graphSessionDetail,
    citationSourceDetailOpen,
    closeCitationSourceDetail,
    graphSourceDetailOpen,
    closeGraphSourceDetail,
    isSlidesDialogOpen,
    closeSlidesDialog,
    isViewerOpen,
    closeOutputViewer,
    isGraphViewOpen,
    closeGraphView,
    isSessionSwitcherOpen,
    closeSessionSwitcher,
  ]);

  const handleGraphSessionClick = useCallback(
    async (session: GraphSessionTarget) => {
      await openGraphSessionDetail(session);
    },
    [openGraphSessionDetail],
  );

  const openCommandPalette = useCallback(() => {
    setShowCommandPalette(true);
  }, []);

  const toggleCommandPalette = useCallback(() => {
    setShowCommandPalette((prev) => !prev);
  }, []);

  const toggleCatalog = useCallback(() => {
    setShowCatalog((prev) => !prev);
  }, []);

  return {
    showCommandPalette,
    showCatalog,
    isSessionSwitcherOpen,
    isShortcutHelpOpen,
    isViewerOpen,
    isViewerFullscreen,
    viewerOutputId,
    isViewerElevated,
    isGraphViewOpen,
    graphSourceDetailOpen,
    graphSelectedSource,
    graphSourceDetailFullscreen,
    citationSourceDetailOpen,
    citationSelectedSource,
    citationSourceDetailFullscreen,
    jumpToSource,
    isSlidesDialogOpen,
    slidesOpenMode,
    slidesDraftId,
    slidesQueueJobId,
    graphSessionDetailOpen: graphSessionDetail.isOpen,
    graphSelectedSession: graphSessionDetail.selectedSession,
    graphSessionDetailFullscreen: graphSessionDetail.isFullscreen,
    graphSessionMessages: graphSessionDetail.messages,
    graphSessionMessagesLoading: graphSessionDetail.isLoading,
    openCommandPalette,
    toggleCommandPalette,
    closeCommandPalette,
    toggleCatalog,
    closeCatalog,
    openShortcutHelp,
    closeShortcutHelp,
    openSessionSwitcher,
    closeSessionSwitcher,
    toggleSessionSwitcher,
    openOutputViewer,
    openOutputViewerFullscreen,
    closeOutputViewer,
    toggleOutputViewer,
    selectOutput,
    setViewerOutputId,
    openGraphView,
    closeGraphView,
    openGraphSourceDetail,
    closeGraphSourceDetail,
    toggleGraphSourceDetailFullscreen,
    openCitationSourceDetail,
    closeCitationSourceDetail,
    toggleCitationSourceDetailFullscreen,
    locateCitationSource,
    openSlidesDialog,
    closeSlidesDialog,
    handleGraphSessionClick,
    closeActiveOverlay,
    closeGraphSessionDetail: graphSessionDetail.closeSessionDetail,
    toggleGraphSessionDetailFullscreen: graphSessionDetail.toggleFullscreen,
  };
}
