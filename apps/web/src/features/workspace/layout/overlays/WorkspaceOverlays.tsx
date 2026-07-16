import { Suspense, lazy } from 'react';

import type { WorkspaceToolsDiagnostics } from '../../../../api/shared-types';
import type { ChatMessage as SourceDialogMessage } from '../../domains/sources/SourceDetailDialog';
import { SkeletonCard } from '../../shared/components/Skeleton';
import type { OutputQueueJob } from '../../shared/hooks/useOutputQueue';
import { WORKSPACE_SHORTCUTS } from '../../shared/shortcuts';
import type { Citation, OutputItem, SourceItem, WorkspaceTool } from '../../shared/types';
import {
  CommandPalette,
  type CommandItem,
  WidgetCatalog,
  WIDGET_REGISTRY,
} from '../modular-canvas';
import ShortcutHelpPanel from '../ShortcutHelpPanel';

const StudioOutputViewer = lazy(() => import('../../domains/outputs/StudioOutputViewer'));
const SlidesStudioDialog = lazy(() => import('../../domains/studio/SlidesStudioDialog'));
const SourceDetailDialog = lazy(() => import('../../domains/sources/SourceDetailDialog'));

interface WorkspaceOverlaysProps {
  commandPaletteOpen: boolean;
  onCloseCommandPalette: () => void;
  commandPaletteCommands: CommandItem[];
  catalogOpen: boolean;
  onCloseCatalog: () => void;
  activeWidgetIds: string[];
  onAddWidget: (widgetId: string) => void;
  shortcutHelpOpen: boolean;
  onCloseShortcutHelp: () => void;
  outputs: OutputItem[];
  viewerOutputId: number | null;
  viewerOpen: boolean;
  viewerFullscreen: boolean;
  viewerElevated: boolean;
  onCloseViewer: () => void;
  onToggleViewerFullscreen: () => void;
  onSelectViewerOutput: (outputId: number) => void;
  onDeleteOutput: (outputId: number) => Promise<void>;
  onOutputCitationJump: (citation: Citation, citations: Citation[]) => void;
  onCitationHover: (chunkId: number | null) => void;
  onLocateCitationSource: (citation: Citation) => void;
  slidesDialogOpen: boolean;
  onCloseSlidesDialog: () => void;
  notebookId: number | null;
  selectedSourceIds: number[];
  isConnected: boolean;
  onOutputsUpdated: () => void;
  slidesOpenMode: 'config' | 'preview';
  slidesDraftId: number | null;
  slidesQueueStatus: OutputQueueJob['status'] | null;
  slidesTool: WorkspaceTool | null;
  toolsDiagnostics: WorkspaceToolsDiagnostics | null;
  onQueueSlides: (payload: {
    title: string;
    prompt: string;
    sourceIds: number[];
    generationConfig: {
      preference?: 'quality' | 'speed' | null;
      quantity?: string | null;
      audience?: string | null;
      structure?: string | null;
      tone?: string | null;
      language?: string | null;
      density?: string | null;
      themePreset?: string | null;
      frontmatter?: string | null;
    };
    modelId?: string | null;
  }) => Promise<{ draftId?: number | null } | null>;
  citationSourceDetailOpen: boolean;
  citationSelectedSource: SourceItem | null;
  onCloseCitationSourceDetail: () => void;
  citationSourceDetailFullscreen: boolean;
  onToggleCitationSourceDetailFullscreen: () => void;
  onSaveCitationSourceQAAsSource: (
    sourceTitle: string,
    messages: SourceDialogMessage[],
  ) => Promise<void>;
}

export function WorkspaceOverlays({
  commandPaletteOpen,
  onCloseCommandPalette,
  commandPaletteCommands,
  catalogOpen,
  onCloseCatalog,
  activeWidgetIds,
  onAddWidget,
  shortcutHelpOpen,
  onCloseShortcutHelp,
  outputs,
  viewerOutputId,
  viewerOpen,
  viewerFullscreen,
  viewerElevated,
  onCloseViewer,
  onToggleViewerFullscreen,
  onSelectViewerOutput,
  onDeleteOutput,
  onOutputCitationJump,
  onCitationHover,
  onLocateCitationSource,
  slidesDialogOpen,
  onCloseSlidesDialog,
  notebookId,
  selectedSourceIds,
  isConnected,
  onOutputsUpdated,
  slidesOpenMode,
  slidesDraftId,
  slidesQueueStatus,
  slidesTool,
  toolsDiagnostics,
  onQueueSlides,
  citationSourceDetailOpen,
  citationSelectedSource,
  onCloseCitationSourceDetail,
  citationSourceDetailFullscreen,
  onToggleCitationSourceDetailFullscreen,
  onSaveCitationSourceQAAsSource,
}: WorkspaceOverlaysProps) {
  return (
    <>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={onCloseCommandPalette}
        commands={commandPaletteCommands}
      />

      <WidgetCatalog
        open={catalogOpen}
        onClose={onCloseCatalog}
        widgetMeta={WIDGET_REGISTRY}
        activeWidgetIds={activeWidgetIds}
        onAddWidget={onAddWidget}
      />

      <ShortcutHelpPanel
        open={shortcutHelpOpen}
        shortcuts={WORKSPACE_SHORTCUTS}
        onClose={onCloseShortcutHelp}
      />

      <Suspense
        fallback={
          <div className="fixed bottom-4 right-4 w-72">
            <SkeletonCard lines={3} />
          </div>
        }
      >
        <StudioOutputViewer
          outputs={outputs}
          selectedOutputId={viewerOutputId}
          isOpen={viewerOpen}
          isFullscreen={viewerFullscreen}
          onClose={onCloseViewer}
          onToggleFullscreen={onToggleViewerFullscreen}
          onSelectOutput={onSelectViewerOutput}
          onDeleteOutput={(...args) => {
            void onDeleteOutput(...args);
          }}
          onJumpToCitation={onOutputCitationJump}
          onCitationHover={onCitationHover}
          onLocateSource={onLocateCitationSource}
          elevated={viewerElevated}
        />
      </Suspense>

      {slidesDialogOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 flex items-center justify-center bg-gray-900/40 dark:bg-gray-950/60">
              <div className="w-[420px]">
                <SkeletonCard lines={6} />
              </div>
            </div>
          }
        >
          <SlidesStudioDialog
            open={slidesDialogOpen}
            onClose={onCloseSlidesDialog}
            notebookId={notebookId}
            selectedSourceIds={selectedSourceIds}
            isConnected={isConnected}
            onOutputsUpdated={onOutputsUpdated}
            openMode={slidesOpenMode}
            draftId={slidesDraftId}
            queueStatus={slidesQueueStatus}
            slidesTool={slidesTool}
            toolsDiagnostics={toolsDiagnostics}
            onQueueSlides={onQueueSlides}
          />
        </Suspense>
      )}

      {citationSourceDetailOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 flex items-center justify-center bg-gray-900/40 dark:bg-gray-950/60">
              <div className="w-[520px]">
                <SkeletonCard lines={5} />
              </div>
            </div>
          }
        >
          <SourceDetailDialog
            open={citationSourceDetailOpen}
            source={citationSelectedSource}
            onClose={onCloseCitationSourceDetail}
            isFullscreen={citationSourceDetailFullscreen}
            onToggleFullscreen={onToggleCitationSourceDetailFullscreen}
            onSaveQAAsSource={onSaveCitationSourceQAAsSource}
          />
        </Suspense>
      )}
    </>
  );
}
