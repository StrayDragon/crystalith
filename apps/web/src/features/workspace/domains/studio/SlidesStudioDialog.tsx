import {
  Button,
  Chip,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  IconButton,
  Typography,
} from '@material-tailwind/react';
import CloseIcon from '@mui/icons-material/Close';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import SlideshowIcon from '@mui/icons-material/Slideshow';

import { useFocusTrap } from '../../shared/hooks/useFocusTrap';
import { SlidesDebugTimings } from './slides/components/SlidesDebugTimings';
import { SlidesGenerationEvents } from './slides/components/SlidesGenerationEvents';
import { SlidesPreviewPanel } from './slides/components/SlidesPreviewPanel';
import { SlidesStageActions } from './slides/components/SlidesStageActions';
import { SlidesStageContent } from './slides/components/SlidesStageContent';
import { SlidesStatusBanners } from './slides/components/SlidesStatusBanners';
import { STAGES } from './slides/constants';
import type { SlidesStudioDialogProps } from './slides/types';
import { useSlidesStudioDialog } from './slides/useSlidesStudioDialog';

export type { SlidesStudioDialogProps } from './slides/types';

export default function SlidesStudioDialog(props: SlidesStudioDialogProps) {
  const {
    dialogRef,
    onClose,
    isFullscreen,
    setIsFullscreen,
    isConfigOnly,
    isPreviewMode,
    slidesEngine,
    headerSubtitle,
    draft,
    activeStage,
    setActiveStage,
    isGenerating,
    error,
    statusMessage,
    events,
    debugTimings,
    gridLayoutClass,
    showPreviewPanel,
    stageContentProps,
    canBuildPreview,
    previewStatus,
    previewStatusTone,
    previewReady,
    previewStale,
    previewError,
    previewSupported,
    previewProviderLabel,
    previewDescriptor,
    previewUrl,
    previewKey,
    isPreviewSyncing,
    isConnected,
    queueStatus,
    handleOpenPreviewWindow,
    handlePreview,
    handleRefreshPreview,
    notebookId,
    loading,
    isQueueing,
    configActionsDisabled,
    onQueueSlidesAvailable,
    handleQueueSlides,
    handleSaveMarkdown,
    saveInputStage,
    handleGenerateOutline,
    handleGenerateAll,
    handleSaveOutline,
    handleGenerateMarkdown,
  } = useSlidesStudioDialog(props);

  useFocusTrap({
    active: props.open,
    containerRef: dialogRef,
    onEscape: onClose,
  });

  return (
    <Dialog
      open={props.open}
      handler={onClose}
      size="xxl"
      className={`rounded-xl overflow-hidden flex flex-col bg-white dark:bg-slate-900 ux-modal-in ${
        isFullscreen
          ? 'absolute inset-0 min-w-[100vw] min-h-[100vh] h-[100vh] max-h-[100vh] w-[100vw] max-w-[100vw]'
          : 'absolute left-[5vw] top-[5vh] min-w-[90vw] min-h-[90vh] h-[90vh] max-h-[90vh] w-[90vw] max-w-[90vw]'
      }`}
    >
      <div ref={dialogRef} tabIndex={-1} className="flex flex-col flex-1 min-h-0">
        <DialogHeader className="flex items-start justify-between gap-4 border-b border-gray-100 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 flex-shrink-0">
              <SlideshowIcon fontSize="small" />
            </div>
            <div className="min-w-0">
              <Typography
                variant="h6"
                className="text-[15px] font-semibold text-gray-900 dark:text-slate-100 truncate"
              >
                演示生成
              </Typography>
              <Typography
                variant="small"
                className="text-gray-500 dark:text-slate-400 text-xs font-medium"
              >
                {headerSubtitle}
              </Typography>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Chip value={slidesEngine || '未配置'} size="sm" variant="ghost" />
            <IconButton
              variant="text"
              size="sm"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="rounded-full"
              aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
            >
              {isFullscreen ? (
                <CloseFullscreenIcon className="h-4 w-4" />
              ) : (
                <OpenInFullIcon className="h-4 w-4" />
              )}
            </IconButton>
            <IconButton
              variant="text"
              size="sm"
              onClick={onClose}
              className="rounded-full"
              aria-label="关闭演示配置"
            >
              <CloseIcon className="h-4 w-4" />
            </IconButton>
          </div>
        </DialogHeader>
        <DialogBody className="p-4 flex-1 overflow-hidden">
          <div className="flex flex-col gap-4 h-full">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {!isConfigOnly && !isPreviewMode && (
                <div className="flex flex-wrap items-center gap-2">
                  {STAGES.map((stage) => (
                    <Button
                      key={stage.id}
                      size="sm"
                      variant={activeStage === stage.id ? 'filled' : 'outlined'}
                      color={activeStage === stage.id ? 'blue' : 'gray'}
                      onClick={() => setActiveStage(stage.id)}
                      disabled={isGenerating}
                    >
                      {stage.label}
                    </Button>
                  ))}
                </div>
              )}
              <Typography variant="small" className="text-gray-500 dark:text-slate-400 text-xs">
                {draft ? `草稿 ${draft.id}` : isConfigOnly ? '新建演示' : '暂无草稿'}
              </Typography>
            </div>
            <div className={`grid grid-cols-1 ${gridLayoutClass} gap-4 flex-1 min-h-0`}>
              <div
                className={`flex flex-col gap-3 min-h-0 ${isPreviewMode ? 'order-2 lg:order-1' : ''}`}
              >
                <SlidesStatusBanners error={error} statusMessage={statusMessage} />
                {events.length > 0 && !isConfigOnly && !isPreviewMode && (
                  <SlidesGenerationEvents events={events} />
                )}
                {import.meta.env.DEV && debugTimings && !isConfigOnly && !isPreviewMode && (
                  <SlidesDebugTimings debugTimings={debugTimings} />
                )}
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex-1 min-h-0 overflow-auto">
                  <SlidesStageContent {...stageContentProps} />
                </div>
              </div>
              {showPreviewPanel && (
                <SlidesPreviewPanel
                  isPreviewMode={isPreviewMode}
                  previewStatus={previewStatus}
                  previewStatusTone={previewStatusTone}
                  previewReady={previewReady}
                  previewStale={previewStale}
                  previewError={previewError}
                  previewSupported={previewSupported}
                  previewProviderLabel={previewProviderLabel}
                  previewDescriptor={previewDescriptor}
                  previewUrl={previewUrl}
                  previewKey={previewKey}
                  canBuildPreview={canBuildPreview}
                  isGenerating={isGenerating}
                  isPreviewSyncing={isPreviewSyncing}
                  isConnected={isConnected}
                  queueStatus={queueStatus}
                  draftStatus={draft?.status}
                  onOpenPreviewWindow={handleOpenPreviewWindow}
                  onPreview={handlePreview}
                  onRefreshPreview={handleRefreshPreview}
                />
              )}
            </div>
          </div>
        </DialogBody>
        <DialogFooter className="flex items-center justify-end border-t border-gray-100 dark:border-slate-700 p-4">
          <SlidesStageActions
            notebookId={notebookId}
            isConfigOnly={isConfigOnly}
            isPreviewMode={isPreviewMode}
            activeStage={activeStage}
            onClose={onClose}
            onQueueSlides={() => {
              void handleQueueSlides();
            }}
            onSaveMarkdown={handleSaveMarkdown}
            onSaveInputStage={saveInputStage}
            onGenerateOutline={handleGenerateOutline}
            onGenerateAll={handleGenerateAll}
            onSaveOutline={handleSaveOutline}
            onGenerateMarkdown={handleGenerateMarkdown}
            onSetActiveStage={setActiveStage}
            onQueueSlidesAvailable={onQueueSlidesAvailable}
            isQueueing={isQueueing}
            loading={loading}
            configActionsDisabled={configActionsDisabled}
            isGenerating={isGenerating}
            draft={draft}
            isConnected={isConnected}
          />
        </DialogFooter>
      </div>
    </Dialog>
  );
}
