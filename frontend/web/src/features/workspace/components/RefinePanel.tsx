import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';

import type {
  OutputItem,
  OutputTypeId,
  RefineJob,
  RefineMode,
  RefineSettings,
  RefineTemplate,
} from '../types';
import { formatOutputForCopy, formatStructuredOutputForCopy } from '../utils';
import OutputTypeSelector from './OutputTypeSelector';

const AudioOverviewOption = lazy(() => import('./AudioOverviewOption'));
const VideoOverviewOption = lazy(() => import('./VideoOverviewOption'));

interface RefinePanelProps {
  mode: RefineMode;
  onModeChange: (mode: RefineMode) => void;
  isBlocked: boolean;
  selectedCitationCount: number;
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  templates: RefineTemplate[];
  jobs: RefineJob[];
  onTogglePin: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
  settings: RefineSettings;
  onToggleSetting: (key: keyof RefineSettings) => void;
  highlightedJobId: string | null;
  outputTypeOptions: { id: OutputTypeId; label: string; description: string }[];
  outputType: OutputTypeId;
  onOutputTypeChange: (value: OutputTypeId) => void;
  isOutputTypeOpen: boolean;
  onToggleOutputType: () => void;
  onCloseOutputType: () => void;
  outputs: OutputItem[];
  outputQueueJobs: { id: string; type: OutputTypeId; status: 'queued' | 'running' | 'done' | 'error' }[];
  queueSummary: { total: number; done: number };
  outputsLoading: boolean;
  outputsError: string;
  onGenerateOutput: () => void;
  onRetryOutputs: () => void;
  onReplayRefineJob: (job: RefineJob) => void;
  onReplayOutput: (output: OutputItem) => void;
  onDeleteOutput: (outputId: number) => void;
}

interface RefineTemplateSectionProps {
  title: string;
  items: RefineTemplate[];
  activeTemplateId: string | null;
  favoriteSet: Set<string>;
  onSelect: (item: RefineTemplate) => void;
  onToggleFavorite: (templateId: string) => void;
}

interface RefineTemplateItemProps {
  item: RefineTemplate;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: (item: RefineTemplate) => void;
  onToggleFavorite: (templateId: string) => void;
}

function RefineTemplateItem({
  item,
  isActive,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: RefineTemplateItemProps) {
  return (
    <div className={`RefineTemplateItem ${isActive ? 'isActive' : ''}`}>
      <button
        type="button"
        className="RefineTemplateButton"
        aria-pressed={isActive}
        onClick={() => onSelect(item)}
      >
        {item.label}
      </button>
      <button
        type="button"
        className={`RefineTemplateStar ${isFavorite ? 'isActive' : ''}`}
        aria-label={isFavorite ? `取消收藏 ${item.label}` : `收藏 ${item.label}`}
        onClick={() => onToggleFavorite(item.id)}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className="RefineTemplateStar__icon"
        >
          <path
            d="M11.48 3.499a.75.75 0 0 1 1.04 0l2.753 2.796 3.87.562a.75.75 0 0 1 .416 1.279l-2.8 2.732.66 3.85a.75.75 0 0 1-1.088.793L12 13.347l-3.46 1.82a.75.75 0 0 1-1.088-.793l.66-3.85-2.8-2.732a.75.75 0 0 1 .416-1.279l3.87-.562 2.753-2.796Z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  );
}

function RefineTemplateSection({
  title,
  items,
  activeTemplateId,
  favoriteSet,
  onSelect,
  onToggleFavorite,
}: RefineTemplateSectionProps) {
  if (!items.length) return null;
  return (
    <div className="RefineTemplateGroup">
      <div className="RefineTemplateGroup__title">{title}</div>
      <div className="RefineTemplateList" role="list">
        {items.map((item) => (
          <RefineTemplateItem
            key={item.id}
            item={item}
            isActive={activeTemplateId === item.id}
            isFavorite={favoriteSet.has(item.id)}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}

function renderMindmapNode(
  node: { label?: string; children?: any[] },
  depth = 0,
  index = 0,
) {
  if (!node) return null;
  return (
    <li key={`${depth}-${index}-${node.label ?? 'node'}`} className={`StructuredMindmapNode depth-${depth}`}>
      <div className="StructuredMindmapLabel">{node.label || '未命名节点'}</div>
      {Array.isArray(node.children) && node.children.length > 0 ? (
        <ul className="StructuredMindmapChildren">
          {node.children.map((child, childIndex) =>
            renderMindmapNode(child, depth + 1, childIndex),
          )}
        </ul>
      ) : null}
    </li>
  );
}

function renderOutputContent(output: OutputItem) {
  const content = output.content ?? {};
  if (output.type === 'FAQ' && Array.isArray((content as any).items)) {
    return (
      <div className="StructuredOutputFaq">
        {(content as any).items.map((item: any, index: number) => (
          <div key={index} className="StructuredOutputFaqItem">
            <div className="StructuredOutputFaqQuestion">{item.question || '问题'}</div>
            <div className="StructuredOutputFaqAnswer">{item.answer || '暂无回答'}</div>
          </div>
        ))}
      </div>
    );
  }

  if (output.type === 'GUIDE' && Array.isArray((content as any).modules)) {
    return (
      <div className="StructuredOutputGuide">
        {(content as any).modules.map((module: any, index: number) => (
          <div key={index} className="StructuredOutputGuideModule">
            <div className="StructuredOutputGuideTitle">{module.title || '模块'}</div>
            <div className="StructuredOutputGuideObjective">
              {module.objective?.text || '暂无目标'}
            </div>
            {Array.isArray(module.key_points) ? (
              <ul className="StructuredOutputList">
                {module.key_points.map((item: any, itemIndex: number) => (
                  <li key={itemIndex}>{item.text || '要点'}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (output.type === 'TIMELINE' && Array.isArray((content as any).events)) {
    return (
      <ul className="StructuredOutputTimeline">
        {(content as any).events.map((event: any, index: number) => (
          <li key={index} className="StructuredOutputTimelineItem">
            <div className="StructuredOutputTimelineDate">{event.date || '时间'}</div>
            <div className="StructuredOutputTimelineEvent">{event.event || '事件'}</div>
            <div className="StructuredOutputTimelineDesc">{event.description || '暂无描述'}</div>
          </li>
        ))}
      </ul>
    );
  }

  if (output.type === 'MINDMAP' && (content as any).root) {
    return (
      <ul className="StructuredMindmapTree">
        {renderMindmapNode((content as any).root, 0, 0)}
      </ul>
    );
  }

  if (output.type === 'QUIZ' && Array.isArray((content as any).questions)) {
    return (
      <div className="StructuredOutputQuiz">
        {(content as any).questions.map((question: any, index: number) => (
          <div key={index} className="StructuredOutputQuizItem">
            <div className="StructuredOutputQuizQuestion">{question.question || '问题'}</div>
            {Array.isArray(question.options) && question.options.length > 0 ? (
              <ul className="StructuredOutputList">
                {question.options.map((option: string) => (
                  <li key={option}>{option}</li>
                ))}
              </ul>
            ) : null}
            <div className="StructuredOutputQuizAnswer">{question.answer || '暂无答案'}</div>
          </div>
        ))}
      </div>
    );
  }

  if (output.type === 'BRIEFING' && Array.isArray((content as any).sections)) {
    return (
      <div className="StructuredOutputBriefing">
        {(content as any).sections.map((section: any, index: number) => (
          <div key={index} className="StructuredOutputBriefingSection">
            <div className="StructuredOutputBriefingHeading">{section.heading || '要点'}</div>
            {Array.isArray(section.points) ? (
              <ul className="StructuredOutputList">
                {section.points.map((point: any, pointIndex: number) => (
                  <li key={pointIndex}>{point.text || '内容'}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (output.type === 'PARAGRAPH' && typeof (content as any).text === 'string') {
    return <p className="StructuredOutputParagraph">{(content as any).text}</p>;
  }

  if (output.type === 'BULLETS' && Array.isArray((content as any).items)) {
    return (
      <ul className="StructuredOutputList">
        {(content as any).items.map((item: any, index: number) => (
          <li key={index}>{item.text || '要点'}</li>
        ))}
      </ul>
    );
  }

  if (output.type === 'STRUCTURED') {
    return (
      <div className="StructuredOutputStructured">
        <div className="StructuredOutputStructuredTitle">
          {(content as any).title || '未命名结构化输出'}
        </div>
        {Array.isArray((content as any).bullets) ? (
          <ul className="StructuredOutputList">
            {(content as any).bullets.map((item: any, index: number) => (
              <li key={index}>{item.text || '要点'}</li>
            ))}
          </ul>
        ) : null}
        {Array.isArray((content as any).terms) && (content as any).terms.length > 0 ? (
          <div className="StructuredOutputTags">
            {(content as any).terms.map((term: string) => (
              <span key={term} className="StructuredOutputTag">
                {term}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <pre className="StructuredOutputRaw">{JSON.stringify(output.content ?? {}, null, 2)}</pre>
  );
}

export default function RefinePanel({
  mode,
  onModeChange,
  isBlocked,
  selectedCitationCount,
  prompt,
  onPromptChange,
  onGenerate,
  templates,
  jobs,
  onTogglePin,
  onDeleteJob,
  settings,
  onToggleSetting,
  highlightedJobId,
  outputTypeOptions,
  outputType,
  onOutputTypeChange,
  isOutputTypeOpen,
  onToggleOutputType,
  onCloseOutputType,
  outputs,
  outputQueueJobs,
  queueSummary,
  outputsLoading,
  outputsError,
  onGenerateOutput,
  onRetryOutputs,
  onReplayRefineJob,
  onReplayOutput,
  onDeleteOutput,
}: RefinePanelProps) {
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const configRef = useRef<HTMLDivElement | null>(null);
  const [favoriteTemplateIds, setFavoriteTemplateIds] = useState<string[]>([]);
  const [recentTemplateIds, setRecentTemplateIds] = useState<string[]>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const [copiedOutputId, setCopiedOutputId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | number | null>(null);
  const audioOverviewFallback = (
    <button type="button" className="RefineMode isDisabled" aria-hidden="true" tabIndex={-1}>
      音频概述
      <span className="RefineModeBadge">即将推出</span>
    </button>
  );
  const videoOverviewFallback = (
    <button type="button" className="RefineMode isDisabled" aria-hidden="true" tabIndex={-1}>
      视频概述
      <span className="RefineModeBadge">即将推出</span>
    </button>
  );
  const normalizedPrompt = prompt.trim();
  const activeTemplate =
    templates.find((item) => item.prompt.trim() === normalizedPrompt) ?? null;
  const activeTemplateId = activeTemplate?.id ?? null;
  const favoriteSet = useMemo(
    () => new Set(favoriteTemplateIds),
    [favoriteTemplateIds],
  );
  const recentTemplates = useMemo(
    () =>
      recentTemplateIds
        .map((id) => templates.find((item) => item.id === id))
        .filter((item): item is RefineTemplate => Boolean(item) && !favoriteSet.has(item.id)),
    [recentTemplateIds, templates, favoriteSet],
  );
  const favoriteTemplates = useMemo(
    () => templates.filter((item) => favoriteSet.has(item.id)),
    [templates, favoriteSet],
  );
  const templateGroups = useMemo(() => {
    const order = ['决策', '行动', '风险', '分析', '洞察', '表达'];
    const grouped = new Map<string, RefineTemplate[]>();
    for (const item of templates) {
      const group = item.group ?? '其他';
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group)?.push(item);
    }
    const sorted: { id: string; label: string; items: RefineTemplate[] }[] = [];
    for (const group of order) {
      if (grouped.has(group)) {
        sorted.push({ id: group, label: group, items: grouped.get(group) ?? [] });
        grouped.delete(group);
      }
    }
    for (const [group, items] of grouped) {
      sorted.push({ id: group, label: group, items });
    }
    return sorted;
  }, [templates]);
  const outputTypeLabel =
    outputTypeOptions.find((item) => item.id === outputType)?.label ?? outputType;
  const statusLabels: Record<RefineJob['status'], string> = {
    queued: '排队中',
    running: '生成中',
    done: '已完成',
    error: '失败',
  };
  const pendingCount = jobs.filter(
    (job) => job.status === 'queued' || job.status === 'running',
  ).length;
  const outputPendingCount = outputQueueJobs.filter(
    (job) => job.status === 'queued' || job.status === 'running',
  ).length;
  const totalCount = jobs.length;
  const queuedCount =
    jobs.filter((job) => job.status === 'queued').length +
    outputQueueJobs.filter((job) => job.status === 'queued').length;
  const runningCount =
    jobs.filter((job) => job.status === 'running').length +
    outputQueueJobs.filter((job) => job.status === 'running').length;
  const combinedPendingCount = pendingCount + outputPendingCount;
  const progress = queueSummary.total
    ? Math.round((queueSummary.done / queueSummary.total) * 100)
    : 0;
  const orderedJobs = useMemo(() => {
    const pinned: RefineJob[] = [];
    const normal: RefineJob[] = [];
    for (const job of jobs) {
      if (job.pinned) pinned.push(job);
      else normal.push(job);
    }
    return [...pinned, ...normal];
  }, [jobs]);
  const queueItems = useMemo(() => {
    const items: { id: string; label: string; status: string }[] = [];
    const outputTypeMap = new Map(
      outputTypeOptions.map((option) => [option.id, option.label]),
    );
    for (const job of jobs) {
      if (job.status !== 'queued' && job.status !== 'running') continue;
      items.push({
        id: `refine-${job.id}`,
        label: job.title,
        status: job.status,
      });
    }
    for (const job of outputQueueJobs) {
      if (job.status !== 'queued' && job.status !== 'running') continue;
      items.push({
        id: `output-${job.id}`,
        label: `结构化输出 - ${outputTypeMap.get(job.type) ?? job.type}`,
        status: job.status,
      });
    }
    return items.slice(0, 4);
  }, [jobs, outputQueueJobs, outputTypeOptions]);

  useEffect(() => {
    if (!isConfigOpen) return undefined;
    function handleClick(event: MouseEvent) {
      if (!configRef.current) return;
      if (configRef.current.contains(event.target as Node)) return;
      setIsConfigOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isConfigOpen]);

  useEffect(() => {
    if (!openMenuId) return undefined;
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-menu-root]')) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [openMenuId]);

  function handleSelectTemplate(item: RefineTemplate) {
    onPromptChange(item.prompt);
    promptRef.current?.focus();
    setRecentTemplateIds((prev) => {
      const next = [item.id, ...prev.filter((id) => id !== item.id)];
      return next.slice(0, 4);
    });
  }

  function handleToggleFavorite(templateId: string) {
    setFavoriteTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId],
    );
  }

  async function handleCopyJob(job: RefineJob) {
    const output = job.outputs?.[mode];
    const content = formatOutputForCopy(output, mode);
    if (!content) return;
    const text = `${job.title}\n${content}`.trim();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedJobId(job.id);
      window.setTimeout(() => {
        setCopiedJobId((current) => (current === job.id ? null : current));
      }, 1500);
    } catch (error) {
      // noop: clipboard may be blocked
    }
  }

  async function handleCopyOutput(output: OutputItem) {
    const content = formatStructuredOutputForCopy(output);
    if (!content) return;
    const label =
      outputTypeOptions.find((item) => item.id === output.type)?.label ?? output.type;
    const text = `${label}\n${content}`.trim();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedOutputId(output.id);
      window.setTimeout(() => {
        setCopiedOutputId((current) => (current === output.id ? null : current));
      }, 1500);
    } catch (error) {
      // noop
    }
  }

  return (
    <div className="WorkspacePanelBody">
      <div className="StructuredOutputCard">
        <div className="StructuredOutputHeader">
          <div>
            <div className="StructuredOutputTitle">结构化输出</div>
            <div className="StructuredOutputSubtitle">
              选择输出类型，生成 FAQ、指南或时间轴等结构化结果。
            </div>
          </div>
          <div className="StructuredOutputActions">
            <OutputTypeSelector
              options={outputTypeOptions}
              value={outputType}
              isOpen={isOutputTypeOpen}
              onToggle={onToggleOutputType}
              onClose={onCloseOutputType}
              onSelect={onOutputTypeChange}
            />
            <button
              type="button"
              className="PrimaryButton"
              onClick={onGenerateOutput}
              disabled={isBlocked || outputsLoading}
            >
              生成{outputTypeLabel}
            </button>
          </div>
        </div>
        {outputsError ? (
          <div className="WorkspaceHint isError">
            {outputsError}
            <button type="button" className="WorkspaceLinkButton" onClick={onRetryOutputs}>
              重试
            </button>
          </div>
        ) : null}
        {outputsLoading && outputs.length === 0 ? (
          <div className="OutputSkeletonList" aria-label="生成结构化输出">
            <div className="OutputSkeletonItem" />
            <div className="OutputSkeletonItem isShort" />
          </div>
        ) : outputs.length === 0 ? (
          <div className="OutputEmpty">
            <div className="OutputEmpty__icon" aria-hidden="true" />
            <div className="OutputEmpty__title">暂无结构化输出</div>
            <div className="OutputEmpty__subtitle">选择类型并点击生成</div>
          </div>
        ) : (
          <div className="StructuredOutputResults">
            {outputs.map((output) => (
              <div key={output.id} className="StructuredOutputItem">
                <div className="StructuredOutputItemHeader">
                  <button
                    type="button"
                    className="StructuredOutputItemHeaderButton"
                    onClick={() => onReplayOutput(output)}
                    title="点击重新生成并入队"
                  >
                    <div>
                      <div className="StructuredOutputItemTitle">
                        {outputTypeOptions.find((item) => item.id === output.type)?.label ??
                          output.type}
                      </div>
                      <div className="StructuredOutputItemMeta">
                        {output.createdAt || '刚刚生成'}
                      </div>
                    </div>
                  </button>
                  <div className="StructuredOutputItemActions">
                    {copiedOutputId === output.id ? (
                      <span className="RefineResultCard__hint">已复制</span>
                    ) : null}
                    <div className="OutputCardMenu" data-menu-root>
                      <button
                        type="button"
                        className="IconButton"
                        aria-label="更多操作"
                        aria-expanded={openMenuId === `output-${output.id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuId((current) =>
                            current === `output-${output.id}` ? null : `output-${output.id}`,
                          );
                        }}
                      >
                        <span aria-hidden="true">...</span>
                      </button>
                      {openMenuId === `output-${output.id}` ? (
                        <div className="OutputCardMenuPanel" role="menu" data-menu-root>
                          <button
                            type="button"
                            className="OutputCardMenuItem"
                            role="menuitem"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleCopyOutput(output);
                              setOpenMenuId(null);
                            }}
                          >
                            复制
                          </button>
                          <button
                            type="button"
                            className="OutputCardMenuItem isDanger"
                            role="menuitem"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteOutput(output.id);
                              setOpenMenuId(null);
                            }}
                          >
                            删除
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                {output.prompt ? (
                  <div className="StructuredOutputItemPrompt">{output.prompt}</div>
                ) : null}
                <div className="StructuredOutputItemContent">{renderOutputContent(output)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="RefineCard">
        <div className="RefineCard__header">
          <div>
            <div className="RefineCard__title">智能提炼</div>
            <div className="RefineCard__subtitle">
              {selectedCitationCount > 0
                ? `已选 ${selectedCitationCount} 条引用，将仅基于选中引用生成输出。`
                : '选择模板或自定义提示词，点击提炼生成输出。'}
            </div>
          </div>
          <div className="RefineCard__actions" ref={configRef}>
            <div className="RefineCard__badge">
              {totalCount ? `历史 ${totalCount} 条` : '暂无历史'}
            </div>
            <button
              type="button"
              className="IconButton"
              aria-label="输出中心配置"
              aria-expanded={isConfigOpen}
              onClick={() => setIsConfigOpen((prev) => !prev)}
              title="输出中心配置"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Zm9.25 3.75a7.25 7.25 0 0 0-.1-1.2l2-1.56-1.9-3.29-2.38.94a7.5 7.5 0 0 0-2.08-1.2L16.5 2h-4.9l-.29 2.69a7.5 7.5 0 0 0-2.08 1.2l-2.38-.94-1.9 3.29 2 1.56a7.25 7.25 0 0 0 0 2.4l-2 1.56 1.9 3.29 2.38-.94a7.5 7.5 0 0 0 2.08 1.2L11.6 22h4.9l.29-2.69a7.5 7.5 0 0 0 2.08-1.2l2.38.94 1.9-3.29-2-1.56c.07-.39.1-.79.1-1.2Z"
                  fill="currentColor"
                />
              </svg>
            </button>
            {isConfigOpen ? (
              <div className="OutputConfigPanel">
                <div className="OutputConfigItem isDisabled">
                  <label className="Switch">
                    <input type="checkbox" checked={settings.autoTrigger} disabled />
                    <span className="SwitchTrack" />
                    <span className="SwitchThumb" />
                  </label>
                  <div>
                    <div className="OutputConfigTitle">对话后自动触发提炼</div>
                    <div className="OutputConfigHint">当前仅支持手动触发</div>
                  </div>
                </div>
                <div className="OutputConfigItem">
                  <label className="Switch">
                    <input
                      type="checkbox"
                      checked={settings.asyncQueue}
                      onChange={() => onToggleSetting('asyncQueue')}
                    />
                    <span className="SwitchTrack" />
                    <span className="SwitchThumb" />
                  </label>
                  <div>
                    <div className="OutputConfigTitle">开启后台异步队列</div>
                    <div className="OutputConfigHint">任务在后台依序生成输出</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="RefineTemplates">
          <RefineTemplateSection
            title="收藏"
            items={favoriteTemplates}
            activeTemplateId={activeTemplateId}
            favoriteSet={favoriteSet}
            onSelect={handleSelectTemplate}
            onToggleFavorite={handleToggleFavorite}
          />
          <RefineTemplateSection
            title="最近"
            items={recentTemplates}
            activeTemplateId={activeTemplateId}
            favoriteSet={favoriteSet}
            onSelect={handleSelectTemplate}
            onToggleFavorite={handleToggleFavorite}
          />
          {templateGroups.map((group) => (
            <RefineTemplateSection
              key={group.id}
              title={group.label}
              items={group.items}
              activeTemplateId={activeTemplateId}
              favoriteSet={favoriteSet}
              onSelect={handleSelectTemplate}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
        <textarea
          className="RefinePrompt"
          ref={promptRef}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={3}
          disabled={isBlocked}
          placeholder={isBlocked ? '请先创建笔记本' : '例如：提炼核心结论、行动项与风险点。'}
        />
        <div className="RefineModes" role="tablist" aria-label="输出格式">
          {([
            { id: 'paragraph', label: '段落' },
            { id: 'bullets', label: '要点' },
            { id: 'structured', label: '结构化' },
          ] as { id: RefineMode; label: string }[]).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={`RefineMode ${mode === item.id ? 'isActive' : ''}`}
              onClick={() => onModeChange(item.id)}
            >
              {item.label}
            </button>
          ))}
          <Suspense fallback={audioOverviewFallback}>
            <AudioOverviewOption />
          </Suspense>
          <Suspense fallback={videoOverviewFallback}>
            <VideoOverviewOption />
          </Suspense>
        </div>
        <div className="RefineActions">
          <button
            type="button"
            className="PrimaryButton"
            onClick={onGenerate}
            disabled={isBlocked || prompt.trim().length === 0}
          >
            立即提炼
          </button>
        </div>
      </div>

      {combinedPendingCount > 0 ? (
        <div className="OutputQueueCard" role="status" aria-live="polite">
          <div className="OutputQueueCard__header">
            <div>
              <div className="OutputQueueCard__title">任务队列</div>
              <div className="OutputQueueCard__meta">
                排队 {queuedCount} / 进行中 {runningCount} / 总计 {queueSummary.total}
              </div>
            </div>
            <div className="OutputQueueCard__ratio">
              {queueSummary.done}/{queueSummary.total || combinedPendingCount}
            </div>
          </div>
          <div className="OutputQueueCard__progress" aria-hidden="true">
            <div
              className="OutputQueueCard__bar"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          {queueItems.length > 0 ? (
            <div className="OutputQueueCard__list">
              {queueItems.map((item) => (
                <div key={item.id} className="OutputQueueItem">
                  <span className="OutputQueueItem__label">{item.label}</span>
                  <span className={`OutputQueueItem__status is-${item.status}`}>
                    {statusLabels[item.status as RefineJob['status']]}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="OutputList" aria-label="输出历史">
        {orderedJobs.length === 0 ? (
          <div className="OutputEmpty">
            <div className="OutputEmpty__icon" aria-hidden="true" />
            <div className="OutputEmpty__title">暂无输出历史</div>
            <div className="OutputEmpty__subtitle">点击左侧按钮或通过聊天触发智能提炼</div>
          </div>
        ) : (
          orderedJobs.map((job) => {
            const output = job.outputs?.[mode];
            const hasOutput = Boolean(
              output?.paragraph ||
                output?.bullets?.length ||
                output?.structured?.title ||
                output?.structured?.bullets?.length ||
                output?.structured?.terms?.length,
            );
            const isPending = job.status === 'queued' || job.status === 'running';
            const timeLabel = job.completedAtLabel ?? job.createdAtLabel;
            return (
              <div
                key={job.id}
                className={`RefineResultCard ${job.pinned ? 'isPinned' : ''} ${
                  isPending ? 'isLoading' : ''
                } ${highlightedJobId === job.id ? 'isNew' : ''}`}
              >
                <div className="RefineResultCard__header">
                  <button
                    type="button"
                    className="RefineResultCard__headerButton"
                    onClick={() => onReplayRefineJob(job)}
                    title="点击重新生成并入队"
                  >
                    <div className="RefineResultCard__title">{job.title}</div>
                    <div className="RefineResultCard__meta">
                      <span className={`RefineResultStatus is-${job.status}`}>
                        {statusLabels[job.status]}
                      </span>
                      <span>
                        {job.chunkIds?.length ? `引用 ${job.chunkIds.length}` : '自动检索'}
                      </span>
                      <span>{timeLabel}</span>
                    </div>
                  </button>
                  <div className="RefineResultCard__actions">
                    {copiedJobId === job.id ? (
                      <span className="RefineResultCard__hint">已复制</span>
                    ) : null}
                    <div className="OutputCardMenu" data-menu-root>
                      <button
                        type="button"
                        className="IconButton"
                        aria-label="更多操作"
                        aria-expanded={openMenuId === `refine-${job.id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuId((current) =>
                            current === `refine-${job.id}` ? null : `refine-${job.id}`,
                          );
                        }}
                      >
                        <span aria-hidden="true">...</span>
                      </button>
                      {openMenuId === `refine-${job.id}` ? (
                        <div className="OutputCardMenuPanel" role="menu" data-menu-root>
                          <button
                            type="button"
                            className="OutputCardMenuItem"
                            role="menuitem"
                            onClick={(event) => {
                              event.stopPropagation();
                              onTogglePin(job.id);
                              setOpenMenuId(null);
                            }}
                          >
                            {job.pinned ? '取消固定' : '固定'}
                          </button>
                          <button
                            type="button"
                            className="OutputCardMenuItem"
                            role="menuitem"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleCopyJob(job);
                              setOpenMenuId(null);
                            }}
                            disabled={!hasOutput}
                          >
                            复制
                          </button>
                          <button
                            type="button"
                            className="OutputCardMenuItem isDanger"
                            role="menuitem"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteJob(job.id);
                              setOpenMenuId(null);
                            }}
                          >
                            删除
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="RefineResultCard__prompt">{job.prompt}</div>
                <div className="RefineResultCard__content">
                  {job.status === 'error' ? (
                    <div className="RefineResultCard__error">{job.error}</div>
                  ) : isPending ? (
                    <div className="RefineResultCard__placeholder">
                      <div className="RefineResultCard__line" />
                      <div className="RefineResultCard__line isShort" />
                      <div className="RefineResultCard__line" />
                    </div>
                  ) : !hasOutput ? (
                    <div className="RefineResultCard__empty">暂无内容</div>
                  ) : mode === 'paragraph' ? (
                    <p className="RefineParagraph">{output?.paragraph}</p>
                  ) : mode === 'bullets' ? (
                    <ul className="RefineBullets">
                      {output?.bullets?.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : mode === 'structured' && output?.structured ? (
                    <div className="RefineStructured">
                      <div className="RefineStructured__title">
                        {output.structured.title || '未命名主题'}
                      </div>
                      <ul className="RefineStructured__bullets">
                        {output.structured.bullets?.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      {output.structured.terms?.length ? (
                        <div className="RefineStructured__terms">
                          {output.structured.terms.map((term) => (
                            <span key={term} className="RefineTag">
                              {term}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
