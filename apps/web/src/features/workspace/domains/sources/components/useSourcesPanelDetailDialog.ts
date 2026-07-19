import type { QAMessage as QaMessage } from '@crystalith/shared';
import { useCallback, useState } from 'react';

import type { SourceItem } from '../../../shared/types';
import type { ChatMessage } from '../SourceDetailDialog';

export function useSourcesPanelDetailDialog({
  isFullscreen = false,
  onConvertSourceQAToSource,
}: {
  isFullscreen?: boolean;
  onConvertSourceQAToSource?: (sourceId: number, messages: QaMessage[]) => Promise<unknown>;
}) {
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<SourceItem | null>(null);
  const [isDetailFullscreen, setIsDetailFullscreen] = useState(false);

  const handleOpenDetail = useCallback(
    (source: SourceItem) => {
      setSelectedSource(source);
      setDetailDialogOpen(true);
      setIsDetailFullscreen(isFullscreen);
    },
    [isFullscreen],
  );

  const handleOpenDetailFullscreen = useCallback((source: SourceItem) => {
    setSelectedSource(source);
    setDetailDialogOpen(true);
    setIsDetailFullscreen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailDialogOpen(false);
    setIsDetailFullscreen(false);
  }, []);

  const handleToggleDetailFullscreen = useCallback(() => {
    setIsDetailFullscreen((prev) => !prev);
  }, []);

  const handleSaveQAAsSource = useCallback(
    async (sourceName: string, messages: ChatMessage[]) => {
      if (!selectedSource || !onConvertSourceQAToSource) return;
      const qaMessages: QaMessage[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
      await onConvertSourceQAToSource(selectedSource.id, qaMessages);
    },
    [selectedSource, onConvertSourceQAToSource],
  );

  return {
    detailDialogOpen,
    selectedSource,
    isDetailFullscreen,
    handleOpenDetail,
    handleOpenDetailFullscreen,
    handleCloseDetail,
    handleToggleDetailFullscreen,
    handleSaveQAAsSource,
  };
}
