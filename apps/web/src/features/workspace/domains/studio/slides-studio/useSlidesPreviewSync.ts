import type { PluginConfig } from '@crystalith/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { t } from '../../../../../shared/i18n';
import type { WorkspaceTool } from '../../../shared/types';
import {
  buildSlidesPreviewUrl,
  resolvePreviewProviderLabel,
  waitForSlidevPreviewReady,
} from './slidesStudioUtils';

export function useSlidesPreviewSync({
  open,
  isPreviewMode,
  isConnected,
  draftId,
  markdown,
  slidesTool,
  slidesConfig,
  slidesConfigErrorMessage,
  slidesEngine,
  handleSaveMarkdown,
}: {
  open: boolean;
  isPreviewMode: boolean;
  isConnected: boolean;
  draftId: number | undefined;
  markdown: string;
  slidesTool: WorkspaceTool | null;
  slidesConfig: PluginConfig | null;
  slidesConfigErrorMessage: string;
  slidesEngine: string | null;
  handleSaveMarkdown: () => Promise<void>;
}) {
  const [previewMarkdown, setPreviewMarkdown] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [isPreviewSyncing, setIsPreviewSyncing] = useState(false);
  const autoPreviewRef = useRef<number | null>(null);

  const previewDescriptor = slidesConfig?.preview ?? null;
  const previewProviderLabel = useMemo(
    () => resolvePreviewProviderLabel(previewDescriptor, slidesEngine),
    [previewDescriptor, slidesEngine],
  );
  const previewUrl = useMemo(
    () => buildSlidesPreviewUrl(previewDescriptor, previewKey),
    [previewDescriptor, previewKey],
  );
  const previewSupported = Boolean(previewUrl);
  const previewStale = useMemo(
    () => Boolean(previewMarkdown && previewMarkdown !== markdown),
    [previewMarkdown, markdown],
  );
  const previewReady = Boolean(previewMarkdown);
  const previewStatus = isPreviewSyncing ? '同步中' : previewReady ? '已同步' : '未同步';
  const previewStatusTone: 'blue' | 'green' | 'gray' = isPreviewSyncing
    ? 'blue'
    : previewReady
      ? 'green'
      : 'gray';

  const resetPreviewState = useCallback(() => {
    setPreviewMarkdown('');
    setPreviewError('');
    setPreviewKey(0);
    setIsPreviewSyncing(false);
    autoPreviewRef.current = null;
  }, []);

  useEffect(() => {
    if (!draftId) {
      resetPreviewState();
      return;
    }
    setPreviewMarkdown('');
    setPreviewError('');
    setPreviewKey(0);
    setIsPreviewSyncing(false);
    autoPreviewRef.current = null;
  }, [draftId, resetPreviewState]);

  const buildPreview = useCallback(
    async (_force = false) => {
      if (!isConnected) {
        setPreviewError(t('studio.slides.connection_required'));
        return;
      }
      if (!slidesTool || !slidesConfig) {
        setPreviewError(slidesConfigErrorMessage || '演示能力当前不可用。');
        return;
      }
      if (!previewDescriptor) {
        setPreviewError('当前 slides 插件未声明预览入口。');
        return;
      }
      if (!previewSupported) {
        setPreviewError(`当前 slides 插件声明了暂不支持的预览服务：${previewProviderLabel}。`);
        return;
      }
      if (!markdown.trim()) {
        setPreviewError('请先生成 Markdown。');
        return;
      }
      setPreviewError('');
      setIsPreviewSyncing(true);
      try {
        await handleSaveMarkdown();
        setPreviewMarkdown(markdown);
        // Saving markdown restarts Slidev briefly; wait until /slidev is up
        // before bumping the iframe key so the panel does not load a 500 page.
        const probeUrl = buildSlidesPreviewUrl(previewDescriptor, Date.now());
        const ready = probeUrl ? await waitForSlidevPreviewReady(probeUrl) : false;
        if (!ready) {
          setPreviewError('预览服务重启中，请稍后点击“强制刷新”。');
          return;
        }
        setPreviewKey((prev) => prev + 1);
      } catch {
        setPreviewError('预览更新失败，请稍后重试。');
      } finally {
        setIsPreviewSyncing(false);
      }
    },
    [
      handleSaveMarkdown,
      isConnected,
      markdown,
      previewDescriptor,
      previewProviderLabel,
      previewSupported,
      slidesConfig,
      slidesConfigErrorMessage,
      slidesTool,
    ],
  );

  const handlePreview = useCallback(() => {
    void buildPreview(false);
  }, [buildPreview]);

  const handleRefreshPreview = useCallback(() => {
    void buildPreview(true);
  }, [buildPreview]);

  useEffect(() => {
    if (!open || !isPreviewMode || !draftId) return;
    if (!markdown.trim()) return;
    if (previewMarkdown) return;
    if (autoPreviewRef.current === draftId) return;
    autoPreviewRef.current = draftId;
    void buildPreview(false);
  }, [buildPreview, draftId, isPreviewMode, markdown, open, previewMarkdown]);

  const handleOpenPreviewWindow = useCallback(() => {
    if (!previewMarkdown || !previewSupported) return;
    const url = buildSlidesPreviewUrl(previewDescriptor, previewKey || Date.now());
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [previewDescriptor, previewKey, previewMarkdown, previewSupported]);

  return {
    previewMarkdown,
    previewError,
    previewKey,
    isPreviewSyncing,
    previewDescriptor,
    previewProviderLabel,
    previewUrl,
    previewSupported,
    previewStale,
    previewReady,
    previewStatus,
    previewStatusTone,
    resetPreviewState,
    handlePreview,
    handleRefreshPreview,
    handleOpenPreviewWindow,
  };
}
