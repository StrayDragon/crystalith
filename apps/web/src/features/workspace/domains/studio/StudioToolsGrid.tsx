import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  IconButton,
  Textarea,
  Tooltip,
  Typography,
} from '@material-tailwind/react';
import { Close as CloseIcon, Edit as EditIcon } from '@mui/icons-material';
import { useCallback, useMemo, useState } from 'react';

import { useGenerationPreference } from '../../shared/hooks/useGenerationPreference';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import type {
  ConfigOption,
  GenerationPreferenceSetting,
  OutputTypeId,
  WorkspaceTool,
} from '../../shared/types';
import { ModelSelector } from './ModelSelector';
import { getToolIcon, resolveTypeLabel, type StudioTone, TONE_COLORS } from './studioUtils';

const FALLBACK_QUANTITY_OPTIONS: ConfigOption[] = [
  { id: 'less', label: '更少', is_default: false },
  { id: 'standard', label: '标准（默认）', is_default: true },
  { id: 'more', label: '更多', is_default: false },
];

interface StudioToolsGridProps {
  tools: WorkspaceTool[];
  toolsLoading?: boolean;
  toolsError?: string;
  onGenerateOutput: (type?: OutputTypeId, modelId?: string | null) => void;
  onOpenSlides?: (options?: {
    mode: 'config' | 'preview';
    slideId?: number | null;
    queueStatus?: 'queued' | 'running' | 'error' | 'done' | 'cancelled' | null;
    queueJobId?: string | null;
  }) => void;
  isConnected: boolean;
  isFullscreen?: boolean;
  hasSelectedSources: boolean;
}

export default function StudioToolsGrid({
  tools,
  toolsLoading,
  toolsError,
  onGenerateOutput,
  onOpenSlides,
  isConnected,
  isFullscreen = false,
  hasSelectedSources,
}: StudioToolsGridProps) {
  const { preference, setPreference } = useGenerationPreference();
  const [toolConfigOpen, setToolConfigOpen] = useState(false);
  const [activeToolType, setActiveToolType] = useState<OutputTypeId | null>(null);
  const [configQuantity, setConfigQuantity] = useState<string>('standard');
  const [configDifficulty, setConfigDifficulty] = useState<string>('medium');
  const [configTopic, setConfigTopic] = useState('');
  const [configModelId, setConfigModelId] = useState<string | null>(null);
  const activeTool = useMemo(
    () => tools.find((tool) => tool.outputType === activeToolType) ?? null,
    [activeToolType, tools],
  );
  const activeToolSchema = activeTool?.configSchema ?? null;
  const quantityOptions = useMemo(() => {
    const options = activeToolSchema?.quantity_options ?? [];
    return options.length > 0 ? options : FALLBACK_QUANTITY_OPTIONS;
  }, [activeToolSchema]);
  const difficultyOptions = useMemo(
    () => activeToolSchema?.difficulty_options ?? [],
    [activeToolSchema],
  );
  const supportsTopic = activeToolSchema?.supports_topic !== false;
  const topicPlaceholder =
    activeToolSchema?.topic_placeholder ||
    '示例提示\n• 限定特定来源或主题\n• 说明重点关注的方向\n• 提供具体的约束条件';

  const typeLabelMap = useMemo(() => {
    const map = new Map<OutputTypeId, string>();
    tools.forEach((tool) => {
      map.set(tool.outputType, tool.label);
    });
    return map;
  }, [tools]);

  const handleToolConfigOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>, toolType: OutputTypeId) => {
      event.stopPropagation();
      if (toolType === 'SLIDES') {
        onOpenSlides?.({ mode: 'config' });
        return;
      }
      setActiveToolType(toolType);
      setToolConfigOpen(true);
      const tool = tools.find((item) => item.outputType === toolType) ?? null;
      const schema = tool?.configSchema ?? null;
      const localQuantityOptions =
        schema?.quantity_options && schema.quantity_options.length > 0
          ? schema.quantity_options
          : FALLBACK_QUANTITY_OPTIONS;
      const localDifficultyOptions = schema?.difficulty_options ?? [];
      setConfigQuantity(localQuantityOptions.find((o) => o.is_default)?.id || 'standard');
      setConfigDifficulty(localDifficultyOptions.find((o) => o.is_default)?.id || 'medium');
      setConfigTopic('');
      setConfigModelId(null);
    },
    [onOpenSlides, tools],
  );

  const handleToolConfigClose = useCallback(() => {
    setToolConfigOpen(false);
    setActiveToolType(null);
    setConfigModelId(null);
  }, []);

  const handleGenerateWithConfig = useCallback(() => {
    if (!activeToolType) return;

    const quantityLabel =
      quantityOptions.find((option) => option.id === configQuantity)?.label ?? configQuantity;
    const difficultyLabel =
      difficultyOptions.find((option) => option.id === configDifficulty)?.label ?? configDifficulty;

    const constraints: string[] = [];
    if (configQuantity) {
      constraints.push(`- 数量：${quantityLabel}`);
    }
    if (difficultyOptions.length > 0 && configDifficulty) {
      constraints.push(`- 难度：${difficultyLabel}`);
    }
    if (configTopic.trim()) {
      constraints.push(`- 主题：${configTopic.trim()}`);
    }

    const promptParts: string[] = [];
    if (activeTool?.prompt?.trim()) {
      promptParts.push(activeTool.prompt.trim());
    }
    if (constraints.length > 0) {
      promptParts.push(`约束：\n${constraints.join('\n')}`);
    }

    const configuredPrompt = promptParts.join('\n\n').trim();

    const s = useWorkspaceStore.getState();
    s.setOutputType(activeToolType);
    if (configuredPrompt) {
      s.setRefinePrompt(configuredPrompt);
    }
    onGenerateOutput(undefined, configModelId);
    handleToolConfigClose();
  }, [
    activeToolType,
    activeTool,
    configDifficulty,
    configModelId,
    configQuantity,
    configTopic,
    difficultyOptions,
    handleToolConfigClose,
    onGenerateOutput,
    quantityOptions,
  ]);

  if (toolsLoading) {
    return (
      <div className={`grid gap-2 ${isFullscreen ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2'}`}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-8 rounded-lg bg-gray-300 animate-pulse" />
        ))}
      </div>
    );
  }

  if (toolsError) {
    return (
      <div className="p-3 text-center rounded-lg bg-red-50 border border-red-200">
        <Typography variant="small" color="red" className="font-medium">
          {toolsError}
        </Typography>
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div className="p-3 text-center border border-dashed border-gray-400 rounded-lg bg-gray-100">
        <Typography variant="small" className="font-medium text-gray-600">
          暂无可用工具
        </Typography>
      </div>
    );
  }

  return (
    <>
      <div className={`grid gap-2 ${isFullscreen ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2'}`}>
        {tools.map((tool) => {
          const isDisabled = !tool.enabled || !tool.outputType || !hasSelectedSources;
          const isSlidesTool = tool.outputType === 'SLIDES';
          const tone = (tool.tone as StudioTone) || 'slate';
          const colors = TONE_COLORS[tone] ?? TONE_COLORS.slate;

          const tooltipContent = !hasSelectedSources
            ? '请先选择来源'
            : tool.description || tool.label;

          return (
            <Tooltip
              key={tool.id}
              content={tooltipContent}
              placement="top"
              className="max-w-[200px] text-xs bg-gray-900 text-white px-2 py-1 rounded"
              animate={{
                mount: { opacity: 1, scale: 1 },
                unmount: { opacity: 0, scale: 0.95 },
              }}
            >
              <div
                className={`group flex items-center gap-2 px-2 py-1.5 min-h-[34px] w-full rounded-lg border text-left font-semibold text-[11px] transition-all hover:shadow-sm hover:-translate-y-[1px] ${
                  isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  color: colors.text,
                }}
              >
                <button
                  type="button"
                  disabled={isDisabled}
                  className="flex flex-1 min-w-0 items-center gap-2 text-left bg-transparent"
                  onClick={() => {
                    if (isDisabled) return;
                    if (isSlidesTool) {
                      onOpenSlides?.({ mode: 'config' });
                      return;
                    }
                    onGenerateOutput(tool.outputType);
                  }}
                >
                  <div
                    className="flex items-center justify-center w-5 h-5 rounded border flex-shrink-0"
                    style={{
                      backgroundColor: colors.icon,
                      borderColor: colors.border,
                    }}
                  >
                    {getToolIcon(tool.outputType)}
                  </div>
                  <span className="leading-tight flex-1 min-w-0">{tool.label}</span>
                  {tool.badge && (
                    <span className="h-3 px-1 text-[8px] bg-gray-900 text-white rounded leading-none flex items-center flex-shrink-0">
                      {tool.badge}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isDisabled}
                  className="flex-shrink-0 h-4 w-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-opacity"
                  onClick={(e) => {
                    e.preventDefault();
                    handleToolConfigOpen(e, tool.outputType);
                  }}
                  aria-label="自定义工具参数"
                >
                  <EditIcon sx={{ fontSize: 10 }} />
                </button>
              </div>
            </Tooltip>
          );
        })}
      </div>

      <Dialog
        open={toolConfigOpen}
        handler={handleToolConfigClose}
        size="xs"
        className="rounded-xl overflow-hidden"
      >
        <DialogHeader className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-500">
              {activeToolType && getToolIcon(activeToolType)}
            </div>
            <Typography variant="h6" color="blue-gray" className="text-sm font-semibold">
              自定义{activeToolType && resolveTypeLabel(activeToolType, typeLabelMap)}
            </Typography>
          </div>
          <IconButton
            variant="text"
            size="sm"
            onClick={handleToolConfigClose}
            className="rounded-full"
          >
            <CloseIcon className="h-4 w-4" />
          </IconButton>
        </DialogHeader>
        <DialogBody className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[60vh]">
          {quantityOptions.length > 0 && (
            <div>
              <Typography variant="small" className="mb-2 font-medium text-gray-700">
                数量
              </Typography>
              <div className="flex flex-wrap gap-2">
                {quantityOptions.map((option) => (
                  <Button
                    key={option.id}
                    variant={configQuantity === option.id ? 'filled' : 'outlined'}
                    size="sm"
                    onClick={() => setConfigQuantity(option.id)}
                    className={`rounded-full px-3 py-1.5 normal-case font-normal border-gray-200 ${
                      configQuantity === option.id ? 'bg-slate-900 text-white' : 'text-gray-700'
                    }`}
                  >
                    {configQuantity === option.id && option.is_default && (
                      <span className="mr-1">✓</span>
                    )}
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {difficultyOptions.length > 0 && (
            <div>
              <Typography variant="small" className="mb-2 font-medium text-gray-700">
                难度等级
              </Typography>
              <div className="flex flex-wrap gap-2">
                {difficultyOptions.map((option) => (
                  <Button
                    key={option.id}
                    variant={configDifficulty === option.id ? 'filled' : 'outlined'}
                    size="sm"
                    onClick={() => setConfigDifficulty(option.id)}
                    className={`rounded-full px-3 py-1.5 normal-case font-normal border-gray-200 ${
                      configDifficulty === option.id ? 'bg-slate-900 text-white' : 'text-gray-700'
                    }`}
                  >
                    {configDifficulty === option.id && option.is_default && (
                      <span className="mr-1">✓</span>
                    )}
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {supportsTopic && (
            <div>
              <Typography variant="small" className="mb-2 font-medium text-gray-700">
                主题应该是什么？
              </Typography>
              <Textarea
                placeholder={topicPlaceholder}
                value={configTopic}
                onChange={(e) => setConfigTopic(e.target.value)}
                className="!border-t-blue-gray-200 focus:!border-t-gray-900 min-h-[100px]"
                labelProps={{
                  className: 'before:content-none after:content-none',
                }}
              />
            </div>
          )}

          <div>
            <Typography variant="small" className="mb-2 font-medium text-gray-700">
              生成倾向
            </Typography>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'default', label: '默认' },
                  { id: 'quality', label: '质量' },
                  { id: 'speed', label: '速度' },
                ] as const satisfies ReadonlyArray<{
                  id: GenerationPreferenceSetting;
                  label: string;
                }>
              ).map((option) => (
                <Button
                  key={option.id}
                  variant={preference === option.id ? 'filled' : 'outlined'}
                  size="sm"
                  onClick={() => setPreference(option.id)}
                  className={`rounded-full px-3 py-1.5 normal-case font-normal border-gray-200 ${
                    preference === option.id ? 'bg-slate-900 text-white' : 'text-gray-700'
                  }`}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Typography variant="small" className="mt-2 text-xs text-gray-500">
              质量：更高召回/重试；速度：更低延迟。
            </Typography>
          </div>

          {isConnected && (
            <div>
              <Typography variant="small" className="mb-2 font-medium text-gray-700">
                AI 模型
              </Typography>
              <ModelSelector
                value={configModelId}
                onChange={setConfigModelId}
                capability="chat"
                label="选择生成模型"
                size="md"
              />
            </div>
          )}
        </DialogBody>

        <DialogFooter className="p-4 pt-2">
          <Button
            variant="filled"
            fullWidth
            onClick={handleGenerateWithConfig}
            className="rounded-full bg-slate-900 normal-case"
          >
            生成
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
