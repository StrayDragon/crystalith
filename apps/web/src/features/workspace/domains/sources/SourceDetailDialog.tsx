import {
  IconButton,
  Typography,
  Tabs,
  TabsHeader,
  TabsBody,
  Tab,
  TabPanel,
} from '@material-tailwind/react';
import {
  Close as CloseIcon,
  Description as DescriptionIcon,
  AutoAwesome as AutoAwesomeIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  DataObject as DataObjectIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { useRef } from 'react';
import { createPortal } from 'react-dom';

import { copyToClipboard } from '../../../../shared/clipboard';
import { t } from '../../../../shared/i18n';
import { useLayer } from '../../../../shared/layer';
import { TestIds, tid } from '../../../../shared/testids';
import { toast } from '../../../../shared/toast';
import { useFocusTrap } from '../../shared/hooks/useFocusTrap';
import type { SourceItem } from '../../shared/types';
import { SourceDetailChunksPanel } from './SourceDetailChunksPanel';
import { SourceDetailQAPanel } from './SourceDetailQAPanel';
import { SourceDetailSummaryPanel } from './SourceDetailSummaryPanel';
import type { ChatMessage } from './sourceDetailTypes';
import { useSourceDetailDialog } from './useSourceDetailDialog';

export type { ChatMessage } from './sourceDetailTypes';

interface SourceDetailDialogProps {
  open: boolean;
  source: SourceItem | null;
  onClose: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onSaveQAAsSource?: (sourceName: string, messages: ChatMessage[]) => Promise<void>;
}

export default function SourceDetailDialog({
  open,
  source,
  onClose,
  isFullscreen = false,
  onToggleFullscreen,
  onSaveQAAsSource,
}: SourceDetailDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const {
    notebookId,
    isConnected,
    activeTab,
    setActiveTab,
    messages,
    inputValue,
    setInputValue,
    isLoading,
    brief,
    isBriefLoading,
    briefError,
    chunks,
    isChunksLoading,
    chunksError,
    summaryCollapsed,
    setSummaryCollapsed,
    isSavingAsSource,
    exportMenuOpen,
    setExportMenuOpen,
    messagesEndRef,
    handleSend,
    handleGenerateOrRefreshBrief,
    handleCopyToClipboard,
    handleDownloadAsFile,
    handleSaveAsSource,
  } = useSourceDetailDialog({ open, source, onSaveQAAsSource });

  const { style: modalStyle } = useLayer('modal');

  useFocusTrap({
    active: open && Boolean(source),
    containerRef: dialogRef,
    onEscape: onClose,
  });

  if (!open || !source) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-4"
      style={modalStyle}
      role="dialog"
      aria-modal="true"
      aria-label={source.title}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t('sources.detail.close_aria')}
        tabIndex={-1}
      />

      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`relative flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 ux-modal-in ${
          isFullscreen ? 'h-[95vh] max-h-[95vh] max-w-[96rem]' : 'h-[80vh] max-h-[80vh] max-w-5xl'
        }`}
        data-testid={TestIds.sourceDetailDialog}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 dark:border-slate-700 p-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 flex-shrink-0">
              <DescriptionIcon fontSize="small" />
            </div>
            <div className="min-w-0">
              <Typography
                variant="h6"
                className="text-[15px] font-semibold text-gray-900 dark:text-slate-100 truncate"
              >
                {source.title}
              </Typography>
              <Typography
                variant="small"
                className="text-gray-500 dark:text-slate-400 text-xs font-medium"
              >
                {t('sources.detail.subtitle')}
              </Typography>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onToggleFullscreen && (
              <IconButton
                variant="text"
                size="sm"
                onClick={onToggleFullscreen}
                className="rounded-full"
              >
                {isFullscreen ? (
                  <FullscreenExitIcon className="h-4 w-4" />
                ) : (
                  <FullscreenIcon className="h-4 w-4" />
                )}
              </IconButton>
            )}
            <IconButton
              variant="text"
              size="sm"
              onClick={onClose}
              className="rounded-full"
              aria-label={t('sources.detail.close_aria')}
              {...tid(TestIds.sourceDetailClose)}
            >
              <CloseIcon className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        <div className="p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
          <Tabs value={activeTab} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <TabsHeader
              className="bg-transparent border-b border-gray-100 dark:border-slate-700 rounded-none p-0"
              indicatorProps={{
                className: 'bg-blue-500/10 shadow-none rounded-none border-b-2 border-blue-500',
              }}
            >
              <Tab
                value="overview"
                onClick={() => {
                  setActiveTab('overview');
                }}
                className={`py-3 px-4 text-xs font-medium ${activeTab === 'overview' ? 'text-blue-500' : 'text-gray-500 dark:text-slate-400'}`}
                {...tid(TestIds.sourceDetailTabSummary)}
              >
                <div className="flex items-center gap-1.5">
                  <AutoAwesomeIcon style={{ fontSize: 14 }} />
                  <span>摘要 & 问答</span>
                </div>
              </Tab>
              <Tab
                value="raw"
                onClick={() => {
                  setActiveTab('raw');
                }}
                className={`py-3 px-4 text-xs font-medium ${activeTab === 'raw' ? 'text-blue-500' : 'text-gray-500 dark:text-slate-400'}`}
                {...tid(TestIds.sourceDetailTabRaw)}
              >
                <div className="flex items-center gap-1.5">
                  <DataObjectIcon style={{ fontSize: 14 }} />
                  <span>原始数据</span>
                  {source.chunks > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-[10px] text-gray-500 dark:text-slate-400">
                      {source.chunks}
                    </span>
                  )}
                </div>
              </Tab>
            </TabsHeader>

            <TabsBody className="flex-1 min-h-0 overflow-hidden">
              <TabPanel value="overview" className="p-0 h-full flex flex-col overflow-hidden">
                {source.statusTone === 'FAILED' &&
                (source.errorMessage || source.recoveryHint || source.errorCode) ? (
                  <div className="mx-4 mt-4 mb-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Typography
                          variant="small"
                          className="text-xs font-semibold text-red-700 dark:text-red-300"
                        >
                          来源处理失败
                        </Typography>
                        {source.errorCode ? (
                          <Typography
                            variant="small"
                            className="mt-1 text-[11px] text-red-700 dark:text-red-300"
                          >
                            错误码：<span className="font-mono">{source.errorCode}</span>
                          </Typography>
                        ) : null}
                        {source.errorMessage ? (
                          <Typography
                            variant="small"
                            className="mt-1 text-[11px] text-red-700 dark:text-red-300"
                          >
                            原因：{source.errorMessage}
                          </Typography>
                        ) : null}
                        {source.recoveryHint ? (
                          <Typography
                            variant="small"
                            className="mt-1 text-[11px] text-red-700 dark:text-red-300"
                          >
                            修复建议：{source.recoveryHint}
                          </Typography>
                        ) : null}
                        {source.lastErrorAt ? (
                          <Typography
                            variant="small"
                            className="mt-1 text-[11px] text-red-600/80 dark:text-red-300/80"
                          >
                            发生时间：{new Date(source.lastErrorAt).toLocaleString('zh-CN')}
                          </Typography>
                        ) : null}
                      </div>
                      <IconButton
                        variant="text"
                        size="sm"
                        onClick={() => {
                          void (async () => {
                            const text = [
                              source.errorCode ? `错误码: ${source.errorCode}` : null,
                              source.errorMessage ? `原因: ${source.errorMessage}` : null,
                              source.recoveryHint ? `修复建议: ${source.recoveryHint}` : null,
                            ]
                              .filter(Boolean)
                              .join('\n');
                            const ok = await copyToClipboard(text);
                            if (ok) toast.success('已复制失败信息');
                            else toast.error('复制失败');
                          })();
                        }}
                        className="rounded-full text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50"
                        aria-label="复制失败信息"
                      >
                        <ContentCopyIcon className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                ) : null}

                <SourceDetailSummaryPanel
                  brief={brief}
                  isBriefLoading={isBriefLoading}
                  briefError={briefError}
                  summaryCollapsed={summaryCollapsed}
                  onToggleCollapsed={() => {
                    setSummaryCollapsed((prev) => !prev);
                  }}
                  onGenerateOrRefresh={handleGenerateOrRefreshBrief}
                  canGenerate={Boolean(notebookId && isConnected)}
                />

                <SourceDetailQAPanel
                  messages={messages}
                  inputValue={inputValue}
                  onInputChange={setInputValue}
                  isLoading={isLoading}
                  isSavingAsSource={isSavingAsSource}
                  exportMenuOpen={exportMenuOpen}
                  onExportMenuOpenChange={setExportMenuOpen}
                  messagesEndRef={messagesEndRef}
                  onSend={() => {
                    void handleSend();
                  }}
                  onCopyToClipboard={() => {
                    void handleCopyToClipboard();
                  }}
                  onDownloadAsFile={handleDownloadAsFile}
                  onSaveAsSource={
                    onSaveQAAsSource
                      ? () => {
                          void handleSaveAsSource();
                        }
                      : undefined
                  }
                  canSaveAsSource={Boolean(onSaveQAAsSource)}
                />
              </TabPanel>

              <TabPanel value="raw" className="p-0 h-full overflow-y-auto">
                <SourceDetailChunksPanel
                  chunks={chunks}
                  isChunksLoading={isChunksLoading}
                  chunksError={chunksError}
                />
              </TabPanel>
            </TabsBody>
          </Tabs>
        </div>
      </div>
    </div>,
    document.body,
  );
}
