import { useCallback, useState } from 'react';

import type { SourceItem } from '../../shared/types';

type SlideOpenMode = 'config' | 'preview';

interface UseWorkspaceOverlaysOptions {
  resolveSlideDraftId: (outputId: number) => number | null;
}

export function useWorkspaceOverlays({ resolveSlideDraftId }: UseWorkspaceOverlaysOptions) {
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [isSessionSwitcherOpen, setIsSessionSwitcherOpen] = useState(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isSystemConfigOpen, setIsSystemConfigOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);
  const [viewerOutputId, setViewerOutputId] = useState<number | null>(null);
  const [isViewerElevated, setIsViewerElevated] = useState(false);
  const [citationSourceDetailOpen, setCitationSourceDetailOpen] = useState(false);
  const [citationSelectedSource, setCitationSelectedSource] = useState<SourceItem | null>(null);
  const [citationSourceDetailFullscreen, setCitationSourceDetailFullscreen] = useState(false);
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

  const openDiagnostics = useCallback(() => {
    setIsDiagnosticsOpen(true);
  }, []);

  const closeDiagnostics = useCallback(() => {
    setIsDiagnosticsOpen(false);
  }, []);

  const openSystemConfig = useCallback(() => {
    setIsSystemConfigOpen(true);
  }, []);

  const closeSystemConfig = useCallback(() => {
    setIsSystemConfigOpen(false);
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
    if (isDiagnosticsOpen) {
      closeDiagnostics();
      return true;
    }
    if (isSystemConfigOpen) {
      closeSystemConfig();
      return true;
    }
    if (citationSourceDetailOpen) {
      closeCitationSourceDetail();
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
    isDiagnosticsOpen,
    closeDiagnostics,
    isSystemConfigOpen,
    closeSystemConfig,
    citationSourceDetailOpen,
    closeCitationSourceDetail,
    isSlidesDialogOpen,
    closeSlidesDialog,
    isViewerOpen,
    closeOutputViewer,
    isSessionSwitcherOpen,
    closeSessionSwitcher,
  ]);

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
    isDiagnosticsOpen,
    isSystemConfigOpen,
    isViewerOpen,
    isViewerFullscreen,
    viewerOutputId,
    isViewerElevated,
    citationSourceDetailOpen,
    citationSelectedSource,
    citationSourceDetailFullscreen,
    isSlidesDialogOpen,
    slidesOpenMode,
    slidesDraftId,
    slidesQueueJobId,
    openCommandPalette,
    toggleCommandPalette,
    closeCommandPalette,
    toggleCatalog,
    closeCatalog,
    openDiagnostics,
    closeDiagnostics,
    openSystemConfig,
    closeSystemConfig,
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
    openCitationSourceDetail,
    closeCitationSourceDetail,
    toggleCitationSourceDetailFullscreen,
    openSlidesDialog,
    closeSlidesDialog,
    closeActiveOverlay,
  };
}
