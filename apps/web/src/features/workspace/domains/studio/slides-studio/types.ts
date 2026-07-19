import type {
  GenerationPreferenceSetting,
  PreviewDescriptor,
  SlideDraft,
  SlideGenerationConfig,
  SlideOutlineItem,
  SlideStage,
  WorkspaceTool,
  WorkspaceToolsDiagnostics,
} from '../../../shared/types';

export interface SlidesStudioDialogProps {
  open: boolean;
  onClose: () => void;
  notebookId: number | null;
  selectedSourceIds?: number[];
  isConnected: boolean;
  onOutputsUpdated: () => void;
  slidesTool?: WorkspaceTool | null;
  toolsDiagnostics?: WorkspaceToolsDiagnostics | null;
  openMode?: 'config' | 'preview';
  draftId?: number | null;
  queueStatus?: 'queued' | 'running' | 'error' | 'done' | 'cancelled' | null;
  onQueueSlides?: (payload: {
    title: string;
    prompt: string;
    sourceIds: number[];
    generationConfig: SlideGenerationConfig;
    modelId?: string | null;
  }) => Promise<{ draftId?: number | null } | null>;
}

export interface SlidesGenerationEvent {
  type: string;
  message: string;
}

export interface SlidesConfigOption {
  id: string;
  label: string;
  isDefault?: boolean;
}

export interface SlidesInputStageProps {
  title: string;
  onTitleChange: (value: string) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  configPreference: GenerationPreferenceSetting;
  onConfigPreferenceChange: (value: GenerationPreferenceSetting) => void;
  configQuantity: string;
  onConfigQuantityChange: (value: string) => void;
  configStructure: string;
  onConfigStructureChange: (value: string) => void;
  configAudience: string;
  onConfigAudienceChange: (value: string) => void;
  configTone: string;
  onConfigToneChange: (value: string) => void;
  configLanguage: string;
  onConfigLanguageChange: (value: string) => void;
  configDensity: string;
  onConfigDensityChange: (value: string) => void;
  configThemePreset: string;
  onConfigThemePresetChange: (value: string) => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  configFrontmatter: string;
  onConfigFrontmatterChange: (value: string) => void;
  frontmatterPreview: string;
  configModelId: string | null;
  onConfigModelIdChange: (value: string | null) => void;
  isConnected: boolean;
  selectionLabel: string;
  quantityOptions: SlidesConfigOption[];
  structureOptions: SlidesConfigOption[];
  audienceOptions: SlidesConfigOption[];
  toneOptions: SlidesConfigOption[];
  languageOptions: SlidesConfigOption[];
  densityOptions: SlidesConfigOption[];
  themePresetOptions: SlidesConfigOption[];
}

export interface SlidesOutlineStageProps {
  outlineTitle: string;
  onOutlineTitleChange: (value: string) => void;
  outlineItems: SlideOutlineItem[];
  onAddSlide: () => void;
  onUpdateSlideTitle: (index: number, value: string) => void;
  onUpdateSlideBullets: (index: number, value: string) => void;
  onRemoveSlide: (index: number) => void;
  selectionLabel: string;
}

export interface SlidesMarkdownStageProps {
  markdown: string;
  onMarkdownChange: (value: string) => void;
  selectionLabel: string;
}

export interface SlidesPreviewModeContentProps {
  title: string;
  outlineTitle: string;
  draft: SlideDraft | null;
  outlineItems: SlideOutlineItem[];
  slidesEngine: string | null;
  queueStatus: 'queued' | 'running' | 'error' | 'done' | 'cancelled' | null;
  showMarkdownEditor: boolean;
  onToggleMarkdownEditor: () => void;
  markdown: string;
  onMarkdownChange: (value: string) => void;
  selectionLabel: string;
}

export interface SlidesStageContentProps {
  loading: boolean;
  slidesConfigErrorMessage: string;
  slidesConfigLoading: boolean;
  slidesConfig: WorkspaceTool['configSchema'] | null;
  notebookId: number | null;
  isConfigOnly: boolean;
  isPreviewMode: boolean;
  activeStage: SlideStage;
  selectionLabel: string;
  quantityOptions: SlidesConfigOption[];
  structureOptions: SlidesConfigOption[];
  audienceOptions: SlidesConfigOption[];
  toneOptions: SlidesConfigOption[];
  languageOptions: SlidesConfigOption[];
  densityOptions: SlidesConfigOption[];
  themePresetOptions: SlidesConfigOption[];
  inputStageProps: SlidesInputStageProps;
  outlineStageProps: SlidesOutlineStageProps;
  markdownStageProps: SlidesMarkdownStageProps;
  previewModeProps: SlidesPreviewModeContentProps;
}

export interface SlidesStageActionsProps {
  notebookId: number | null;
  isConfigOnly: boolean;
  isPreviewMode: boolean;
  activeStage: SlideStage;
  onClose: () => void;
  onQueueSlides: () => void;
  onSaveMarkdown: () => void;
  onSaveInputStage: () => void;
  onGenerateOutline: () => void;
  onGenerateAll: () => void;
  onSaveOutline: () => void;
  onGenerateMarkdown: () => void;
  onSetActiveStage: (stage: SlideStage) => void;
  onQueueSlidesAvailable: boolean;
  isQueueing: boolean;
  loading: boolean;
  configActionsDisabled: boolean;
  isGenerating: boolean;
  draft: SlideDraft | null;
  isConnected: boolean;
}

export interface SlidesPreviewPanelProps {
  isPreviewMode: boolean;
  previewStatus: string;
  previewStatusTone: 'blue' | 'green' | 'gray';
  previewReady: boolean;
  previewStale: boolean;
  previewError: string;
  previewSupported: boolean;
  previewProviderLabel: string;
  previewDescriptor: PreviewDescriptor | null;
  previewUrl: string;
  previewKey: number;
  canBuildPreview: boolean;
  isGenerating: boolean;
  isPreviewSyncing: boolean;
  isConnected: boolean;
  queueStatus: 'queued' | 'running' | 'error' | 'done' | 'cancelled' | null;
  draftStatus: string | undefined;
  onOpenPreviewWindow: () => void;
  onPreview: () => void;
  onRefreshPreview: () => void;
}
