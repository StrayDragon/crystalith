import { Button, Chip, IconButton, Spinner, Typography } from '@material-tailwind/react';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useEffect, useState } from 'react';

import { waitForSlidevPreviewReady } from '../slidesStudioUtils';
import type { SlidesPreviewPanelProps } from '../types';

export function SlidesPreviewPanel({
  isPreviewMode,
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
  canBuildPreview,
  isGenerating,
  isPreviewSyncing,
  isConnected,
  queueStatus,
  draftStatus,
  onOpenPreviewWindow,
  onPreview,
  onRefreshPreview,
}: SlidesPreviewPanelProps) {
  const [frameSrc, setFrameSrc] = useState('');
  const [frameWaiting, setFrameWaiting] = useState(false);
  const [frameFailed, setFrameFailed] = useState(false);

  useEffect(() => {
    if (!previewReady || !previewSupported || !previewUrl) {
      setFrameSrc('');
      setFrameWaiting(false);
      setFrameFailed(false);
      return;
    }

    let cancelled = false;
    const ac = new AbortController();
    setFrameSrc('');
    setFrameWaiting(true);
    setFrameFailed(false);

    void waitForSlidevPreviewReady(previewUrl, { signal: ac.signal }).then((ok) => {
      if (cancelled) return;
      setFrameWaiting(false);
      if (ok) setFrameSrc(previewUrl);
      else setFrameFailed(true);
    });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [previewReady, previewSupported, previewUrl, previewKey]);

  const showFrame = previewReady && previewSupported;
  const busy =
    isPreviewSyncing ||
    isGenerating ||
    queueStatus === 'running' ||
    draftStatus === 'running' ||
    frameWaiting;

  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-slate-700 bg-gradient-to-br from-white via-white to-slate-50 p-3 flex flex-col min-h-0 shadow-sm ${isPreviewMode ? 'order-1 lg:order-2' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-slate-700 pb-2">
        <div className="flex items-center gap-2">
          <Typography variant="small" className="text-gray-700 dark:text-slate-200 font-semibold">
            幻灯片预览
          </Typography>
          <Chip value={previewStatus} size="sm" variant="ghost" color={previewStatusTone} />
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            variant="text"
            size="sm"
            onClick={onOpenPreviewWindow}
            className="rounded-full"
            disabled={!previewReady || !frameSrc}
            aria-label="在新窗口打开预览"
          >
            <OpenInNewIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button
          size="sm"
          color="blue"
          onClick={onPreview}
          disabled={!canBuildPreview || isGenerating || isPreviewSyncing || !isConnected}
        >
          {isPreviewSyncing ? (
            <span className="flex items-center gap-2">
              <Spinner className="h-3 w-3" />
              同步中
            </span>
          ) : previewReady ? (
            '同步预览'
          ) : (
            '生成预览'
          )}
        </Button>
        {previewReady && (
          <Button
            size="sm"
            variant="outlined"
            onClick={onRefreshPreview}
            disabled={isGenerating || isPreviewSyncing || !isConnected}
          >
            强制刷新
          </Button>
        )}
      </div>
      {isPreviewMode && !previewReady && canBuildPreview && (
        <Typography variant="small" className="text-xs text-gray-500 dark:text-slate-400 mt-2">
          自动同步预览已开启，如未更新可点击“同步预览”。
        </Typography>
      )}
      {previewStale && (
        <Typography variant="small" className="text-amber-600 text-xs mt-2">
          预览已过期，请刷新以同步最新 Markdown。
        </Typography>
      )}
      {previewError && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 mt-2"
        >
          {previewError}
        </div>
      )}
      {frameFailed && !previewError && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 mt-2"
        >
          预览服务尚未就绪，请点击“强制刷新”重试。
        </div>
      )}
      <div className="mt-3 flex-1 min-h-0 rounded-lg border border-slate-200 bg-slate-900/5 overflow-hidden flex items-center justify-center p-3">
        {showFrame && frameSrc ? (
          <div className="h-full w-auto max-w-full aspect-video rounded-lg overflow-hidden shadow-lg bg-white dark:bg-slate-800 relative">
            <iframe
              key={previewKey}
              title={`${previewProviderLabel} 预览`}
              src={frameSrc}
              className="h-full w-full border-0 bg-white dark:bg-slate-800 relative z-10"
            />
          </div>
        ) : busy ? (
          <div className="w-full max-w-full aspect-video rounded-lg border border-dashed border-slate-300 bg-white dark:bg-slate-900/70 flex flex-col items-center justify-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <Spinner className="h-4 w-4" />
            <span>{frameWaiting ? '等待预览服务就绪…' : '预览同步中...'}</span>
          </div>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-xs text-gray-500 dark:text-slate-400 px-6 text-center">
            <span>暂无预览，请先生成 Markdown 或点击“同步预览”。</span>
            <span className="text-[11px] text-gray-400 dark:text-slate-500">
              {previewDescriptor
                ? `预览基于 ${previewProviderLabel} 服务。`
                : '当前 slides 插件未声明预览入口。'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
