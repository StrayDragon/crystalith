import { Spinner, Typography } from '@material-tailwind/react';

import type { SlidesStageContentProps } from '../types';
import { SlidesInputStage } from './SlidesInputStage';
import { SlidesMarkdownStage } from './SlidesMarkdownStage';
import { SlidesOutlineStage } from './SlidesOutlineStage';
import { SlidesPreviewModeContent } from './SlidesPreviewModeContent';

export function SlidesStageContent({
  loading,
  slidesConfigErrorMessage,
  slidesConfigLoading,
  slidesConfig,
  notebookId,
  isConfigOnly,
  isPreviewMode,
  activeStage,
  inputStageProps,
  outlineStageProps,
  markdownStageProps,
  previewModeProps,
}: SlidesStageContentProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (slidesConfigErrorMessage) {
    return (
      <div className="rounded-lg border border-dashed border-red-200 bg-red-50 p-6 text-center">
        <Typography variant="small" className="text-red-600">
          {slidesConfigErrorMessage}
        </Typography>
      </div>
    );
  }

  if ((isConfigOnly || activeStage === 'input') && slidesConfigLoading && !slidesConfig) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!notebookId) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 dark:border-slate-600 p-6 text-center">
        <Typography variant="small" className="text-gray-600 dark:text-slate-300">
          请先创建或选择笔记本。
        </Typography>
      </div>
    );
  }

  if (isPreviewMode) {
    return <SlidesPreviewModeContent {...previewModeProps} />;
  }

  if (isConfigOnly || activeStage === 'input') {
    return <SlidesInputStage {...inputStageProps} />;
  }

  if (activeStage === 'outline') {
    return <SlidesOutlineStage {...outlineStageProps} />;
  }

  return <SlidesMarkdownStage {...markdownStageProps} />;
}
