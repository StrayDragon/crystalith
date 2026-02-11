import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { getToolConfigV1WorkspaceToolsToolIdConfigGet as getToolConfig, type ToolConfigResponse } from '../../../../api/generated';
import { ModelSelector } from './ModelSelector';
import type { OutputTypeId, WorkspaceTool } from '../../shared/types';
import { getToolIcon, resolveTypeLabel, type StudioTone, TONE_COLORS } from './studioUtils';

interface StudioToolsGridProps {
  tools: WorkspaceTool[];
  toolsLoading?: boolean;
  toolsError?: string;
  onGenerateOutput: (type?: OutputTypeId, modelId?: string | null) => void;
  onOpenSlides?: (options?: {
    mode: 'config' | 'preview';
    slideId?: number | null;
    queueStatus?: 'queued' | 'running' | 'error' | 'done' | null;
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
  const [toolConfigOpen, setToolConfigOpen] = useState(false);
  const [activeToolType, setActiveToolType] = useState<OutputTypeId | null>(null);
  const [configQuantity, setConfigQuantity] = useState<string>('standard');
  const [configDifficulty, setConfigDifficulty] = useState<string>('medium');
  const [configTopic, setConfigTopic] = useState('');
  const [configModelId, setConfigModelId] = useState<string | null>(null);
  const [toolConfig, setToolConfig] = useState<ToolConfigResponse | null>(null);
  const [toolConfigLoading, setToolConfigLoading] = useState(false);

  const typeLabelMap = useMemo(() => {
    const map = new Map<OutputTypeId, string>();
    tools.forEach((tool) => {
      map.set(tool.outputType, tool.label);
    });
    return map;
  }, [tools]);

  useEffect(() => {
    if (!toolConfigOpen || !activeToolType || !isConnected) return;

    const toolId = activeToolType.toLowerCase();
    setToolConfigLoading(true);
    getToolConfig({ path: { tool_id: toolId } })
      .then((config) => {
        setToolConfig(config);
        const defaultQuantity =
          config.quantity_options?.find((o) => o.is_default)?.id || 'standard';
        const defaultDifficulty =
          config.difficulty_options?.find((o) => o.is_default)?.id || 'medium';
        setConfigQuantity(defaultQuantity);
        setConfigDifficulty(defaultDifficulty);
      })
      .catch(() => {
        setToolConfig(null);
      })
      .finally(() => {
        setToolConfigLoading(false);
      });
  }, [toolConfigOpen, activeToolType, isConnected]);

  const handleToolConfigOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>, toolType: OutputTypeId) => {
      event.stopPropagation();
      if (toolType === 'SLIDES') {
        onOpenSlides?.({ mode: 'config' });
        return;
      }
      setActiveToolType(toolType);
      setToolConfigOpen(true);
      setConfigQuantity('standard');
      setConfigDifficulty('medium');
      setConfigTopic('');
      setConfigModelId(null);
      setToolConfig(null);
    },
    [onOpenSlides],
  );

  const handleToolConfigClose = useCallback(() => {
    setToolConfigOpen(false);
    setActiveToolType(null);
    setToolConfig(null);
    setConfigModelId(null);
  }, []);

  const handleGenerateWithConfig = useCallback(() => {
    if (activeToolType) {
      onGenerateOutput(activeToolType, configModelId);
    }
    handleToolConfigClose();
  }, [activeToolType, configModelId, onGenerateOutput, handleToolConfigClose]);

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
          const colors = TONE_COLORS[tone];

          const tooltipContent = !hasSelectedSources
            ? '请先选择来源'
            : (tool.description || tool.label);

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
              <button
                type="button"
                disabled={isDisabled}
                className={`group flex items-center gap-2 px-2 py-1.5 min-h-[34px] w-full rounded-lg border text-left font-semibold text-[11px] transition-all hover:shadow-sm hover:-translate-y-[1px] ${
                  isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  color: colors.text,
                }}
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
                <span
                  role="button"
                  tabIndex={-1}
                  className="flex-shrink-0 h-4 w-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleToolConfigOpen(e as unknown as React.MouseEvent<HTMLElement>, tool.outputType);
                  }}
                  aria-label="自定义工具参数"
                >
                  <EditIcon sx={{ fontSize: 10 }} />
                </span>
              </button>
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
          <IconButton variant="text" size="sm" onClick={handleToolConfigClose} className="rounded-full">
            <CloseIcon className="h-4 w-4" />
          </IconButton>
        </DialogHeader>

        <DialogBody className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[60vh]">
          {toolConfigLoading ? (
            <div className="flex flex-col gap-3">
              <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
              {(toolConfig?.quantity_options || !toolConfig) && (
                <div>
                  <Typography variant="small" className="mb-2 font-medium text-gray-700">
                    数量
                  </Typography>
                  <div className="flex flex-wrap gap-2">
                    {(toolConfig?.quantity_options || [
                      { id: 'less', label: '更少', is_default: false },
                      { id: 'standard', label: '标准（默认）', is_default: true },
                      { id: 'more', label: '更多', is_default: false },
                    ]).map((option) => (
                      <Button
                        key={option.id}
                        variant={configQuantity === option.id ? 'filled' : 'outlined'}
                        size="sm"
                        onClick={() => setConfigQuantity(option.id)}
                        className={`rounded-full px-3 py-1.5 normal-case font-normal border-gray-200 ${
                          configQuantity === option.id ? 'bg-slate-900 text-white' : 'text-gray-700'
                        }`}
                      >
                        {configQuantity === option.id && option.is_default && <span className="mr-1">✓</span>}
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {(toolConfig?.difficulty_options || (!toolConfig && activeToolType !== 'FAQ' && activeToolType !== 'TIMELINE' && activeToolType !== 'MINDMAP' && activeToolType !== 'BRIEFING')) && (
                <div>
                  <Typography variant="small" className="mb-2 font-medium text-gray-700">
                    难度等级
                  </Typography>
                  <div className="flex flex-wrap gap-2">
                    {(toolConfig?.difficulty_options || [
                      { id: 'easy', label: '简单', is_default: false },
                      { id: 'medium', label: '中等（默认）', is_default: true },
                      { id: 'hard', label: '困难', is_default: false },
                    ]).map((option) => (
                      <Button
                        key={option.id}
                        variant={configDifficulty === option.id ? 'filled' : 'outlined'}
                        size="sm"
                        onClick={() => setConfigDifficulty(option.id)}
                        className={`rounded-full px-3 py-1.5 normal-case font-normal border-gray-200 ${
                          configDifficulty === option.id ? 'bg-slate-900 text-white' : 'text-gray-700'
                        }`}
                      >
                        {configDifficulty === option.id && option.is_default && <span className="mr-1">✓</span>}
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {(toolConfig?.supports_topic !== false) && (
                <div>
                  <Typography variant="small" className="mb-2 font-medium text-gray-700">
                    主题应该是什么？
                  </Typography>
                  <Textarea
                    placeholder={toolConfig?.topic_placeholder || "示例提示\n• 限定特定来源或主题\n• 说明重点关注的方向\n• 提供具体的约束条件"}
                    value={configTopic}
                    onChange={(e) => setConfigTopic(e.target.value)}
                    className="!border-t-blue-gray-200 focus:!border-t-gray-900 min-h-[100px]"
                    labelProps={{
                      className: "before:content-none after:content-none",
                    }}
                  />
                </div>
              )}

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
            </>
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
