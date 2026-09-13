import { Button } from '../../../../../../shared/ui';
import type { SlidesStageActionsProps } from '../types';

export function SlidesStageActions({
  notebookId,
  isConfigOnly,
  isPreviewMode,
  activeStage,
  onClose,
  onQueueSlides,
  onSaveMarkdown,
  onSaveInputStage,
  onGenerateOutline,
  onGenerateAll,
  onSaveOutline,
  onGenerateMarkdown,
  onSetActiveStage,
  onQueueSlidesAvailable,
  isQueueing,
  loading,
  configActionsDisabled,
  isGenerating,
  draft,
  isConnected,
}: SlidesStageActionsProps) {
  if (!notebookId) {
    return (
      <Button variant="outlined" onClick={onClose}>
        关闭
      </Button>
    );
  }

  if (isConfigOnly) {
    return (
      <div className="flex gap-2">
        <Button variant="outlined" onClick={onClose}>
          关闭
        </Button>
        <Button
          color="blue"
          onClick={onQueueSlides}
          disabled={!onQueueSlidesAvailable || isQueueing || loading || configActionsDisabled}
        >
          生成
        </Button>
      </div>
    );
  }

  if (isPreviewMode) {
    return (
      <div className="flex gap-2">
        <Button variant="outlined" onClick={onClose}>
          关闭
        </Button>
        <Button
          variant="outlined"
          onClick={onSaveMarkdown}
          disabled={isGenerating || !draft || !isConnected}
        >
          保存 Markdown
        </Button>
      </div>
    );
  }

  if (activeStage === 'input') {
    return (
      <div className="flex gap-2">
        <Button variant="outlined" onClick={onClose}>
          关闭
        </Button>
        <Button
          variant="outlined"
          onClick={onSaveInputStage}
          disabled={isGenerating || configActionsDisabled}
        >
          保存
        </Button>
        <Button
          variant="outlined"
          onClick={onGenerateOutline}
          disabled={isGenerating || configActionsDisabled}
        >
          生成大纲
        </Button>
        <Button
          color="blue"
          onClick={onGenerateAll}
          disabled={isGenerating || configActionsDisabled}
        >
          一键生成
        </Button>
      </div>
    );
  }

  if (activeStage === 'outline') {
    return (
      <div className="flex gap-2">
        <Button
          variant="outlined"
          onClick={() => {
            onSetActiveStage('input');
          }}
        >
          返回输入
        </Button>
        <Button variant="outlined" onClick={onSaveOutline} disabled={isGenerating || !isConnected}>
          保存大纲
        </Button>
        <Button color="blue" onClick={onGenerateMarkdown} disabled={isGenerating || !isConnected}>
          生成 Markdown
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outlined"
        onClick={() => {
          onSetActiveStage('outline');
        }}
      >
        返回大纲
      </Button>
      <Button variant="outlined" onClick={onSaveMarkdown} disabled={isGenerating || !isConnected}>
        保存 Markdown
      </Button>
    </div>
  );
}
