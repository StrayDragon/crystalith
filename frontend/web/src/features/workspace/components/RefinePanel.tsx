import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';

import type {
  Citation,
  OutputItem,
  OutputTypeId,
  RefineJob,
  RefineMode,
  RefineSettings,
  RefineTemplate,
} from '../types';
import { formatOutputForCopy, formatRelativeTime, formatStructuredOutputForCopy } from '../utils';

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
  outputTypeOptions: { id: OutputTypeId; label: string; description: string; prompt: string }[];
  outputType: OutputTypeId;
  outputs: OutputItem[];
  outputQueueJobs: { id: string; type: OutputTypeId; status: 'queued' | 'running' | 'done' | 'error' }[];
  queueSummary: { total: number; done: number };
  outputsLoading: boolean;
  outputsError: string;
  onGenerateOutput: (type?: OutputTypeId) => void;
  onSelectOutputType: (type: OutputTypeId) => void;
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

const STUDIO_ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

type StudioIconId = OutputTypeId | 'AUDIO' | 'VIDEO' | 'REFINE';

type StudioTone = 'slate' | 'blue' | 'green' | 'rose' | 'amber' | 'teal' | 'indigo';

const STUDIO_TONE_MAP: Record<StudioIconId, StudioTone> = {
  AUDIO: 'blue',
  VIDEO: 'green',
  FAQ: 'rose',
  GUIDE: 'teal',
  TIMELINE: 'amber',
  MINDMAP: 'indigo',
  QUIZ: 'blue',
  BRIEFING: 'slate',
  REFINE: 'slate',
};

function resolveStudioTone(id: StudioIconId): StudioTone {
  return STUDIO_TONE_MAP[id] ?? 'slate';
}

function renderStudioIcon(id: StudioIconId) {
  switch (id) {
    case 'FAQ':
      return (
        <svg {...STUDIO_ICON_PROPS} aria-hidden="true" focusable="false">
          <path d="M6.5 6.5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H11l-4 3v-3h-.5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z" />
          <path d="M10.5 10.5a2 2 0 0 1 4 0c0 1.3-1 1.7-1.6 2.2" />
          <circle cx="12" cy="14.75" r="0.75" />
        </svg>
      );
    case 'GUIDE':
      return (
        <svg {...STUDIO_ICON_PROPS} aria-hidden="true" focusable="false">
          <path d="M5 5.5h10a2 2 0 0 1 2 2v11.5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2V7.5a2 2 0 0 1 2-2Z" />
          <path d="M7 8.5h6M7 12h6" />
        </svg>
      );
    case 'TIMELINE':
      return (
        <svg {...STUDIO_ICON_PROPS} aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="7" />
          <path d="M12 8v4.5l3 1.5" />
        </svg>
      );
    case 'MINDMAP':
      return (
        <svg {...STUDIO_ICON_PROPS} aria-hidden="true" focusable="false">
          <circle cx="6" cy="6" r="2" />
          <circle cx="18" cy="6" r="2" />
          <circle cx="12" cy="18" r="2" />
          <path d="M8 6h8M12 8v6M9 15l3 3 3-3" />
        </svg>
      );
    case 'QUIZ':
      return (
        <svg {...STUDIO_ICON_PROPS} aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="7" />
          <path d="m9.5 12.5 2 2 4-4" />
        </svg>
      );
    case 'BRIEFING':
      return (
        <svg {...STUDIO_ICON_PROPS} aria-hidden="true" focusable="false">
          <rect x="5" y="5" width="14" height="8" rx="2" />
          <path d="M9 19h6M12 13v6M8 9h2M12 9h4" />
        </svg>
      );
    case 'AUDIO':
      return (
        <svg {...STUDIO_ICON_PROPS} aria-hidden="true" focusable="false">
          <path d="M6 14v-4M10 17V7M14 19V5M18 15v-6" />
        </svg>
      );
    case 'VIDEO':
      return (
        <svg {...STUDIO_ICON_PROPS} aria-hidden="true" focusable="false">
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="m10 9 5 3-5 3Z" />
        </svg>
      );
    case 'REFINE':
    default:
      return (
        <svg {...STUDIO_ICON_PROPS} aria-hidden="true" focusable="false">
          <path d="m12 3 1.8 4.8L18.5 9l-4.7 1.2L12 15l-1.8-4.8L5.5 9l4.7-1.2L12 3Z" />
        </svg>
      );
  }
}

type OutputHistoryItem =
  | {
      key: string;
      kind: 'refine';
      sortKey: number;
      job: RefineJob;
      hasOutput: boolean;
      timeLabel: string;
    }
  | {
      key: string;
      kind: 'output';
      sortKey: number;
      output: OutputItem;
      label: string;
      title: string;
      timeLabel: string;
      sourcesLabel: string;
      hasSources: boolean;
    };

function resolveOutputTitle(output: OutputItem, fallbackLabel: string) {
  const content = output.content ?? {};
  const contentTitle =
    typeof (content as any).title === 'string' ? (content as any).title.trim() : '';
  if (contentTitle) return contentTitle;
  const promptTitle = output.prompt?.trim();
  if (promptTitle) return promptTitle;
  return `${fallbackLabel} 输出`;
}

function collectOutputSourceNames(value: unknown, names: Set<string>) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectOutputSourceNames(item, names));
    return;
  }
  if (typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  for (const [key, entry] of Object.entries(record)) {
    if (key === 'citations' && Array.isArray(entry)) {
      for (const citation of entry) {
        if (!citation || typeof citation !== 'object') continue;
        const sourceName =
          (citation as any).source_name ||
          (citation as any).sourceName ||
          (citation as any).source_title ||
          (citation as any).sourceTitle ||
          '';
        if (typeof sourceName === 'string' && sourceName.trim()) {
          names.add(sourceName.trim());
        }
      }
      continue;
    }
    collectOutputSourceNames(entry, names);
  }
}

function extractOutputSourceNames(content: Record<string, unknown>) {
  const names = new Set<string>();
  collectOutputSourceNames(content, names);
  return Array.from(names);
}

function formatSourceTitle(names: string[]) {
  if (!names.length) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}、${names[1]}`;
  return `${names[0]} 等${names.length}个来源`;
}

function extractCitationSourceNames(citations?: Citation[]) {
  if (!citations?.length) return [];
  const names = new Set<string>();
  for (const citation of citations) {
    const title = citation.sourceTitle?.trim();
    if (title) names.add(title);
  }
  return Array.from(names);
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
  outputs,
  outputQueueJobs,
  queueSummary,
  outputsLoading,
  outputsError,
  onGenerateOutput,
  onSelectOutputType,
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
  const outputTypeLabelMap = useMemo(
    () => new Map(outputTypeOptions.map((option) => [option.id, option.label])),
    [outputTypeOptions],
  );
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
  const queueItems = useMemo(() => {
    const items: { id: string; label: string; status: string }[] = [];
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
        label: `结构化输出 - ${outputTypeLabelMap.get(job.type) ?? job.type}`,
        status: job.status,
      });
    }
    return items.slice(0, 4);
  }, [jobs, outputQueueJobs, outputTypeLabelMap]);
  const outputPromptMap = useMemo(
    () => new Map(outputTypeOptions.map((option) => [option.id, option.prompt])),
    [outputTypeOptions],
  );
  const studioTiles = useMemo(
    () => [
      { id: 'AUDIO', label: '音频概览', description: '即将推出', disabled: true, badge: '即将推出' },
      { id: 'VIDEO', label: '视频概览', description: '即将推出', disabled: true, badge: '即将推出' },
      ...outputTypeOptions.map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description,
        type: option.id,
      })),
    ],
    [outputTypeOptions],
  );
  const outputHistory = useMemo<OutputHistoryItem[]>(() => {
    const items: OutputHistoryItem[] = [];
    for (const job of jobs) {
      const output = job.outputs?.[mode];
      const hasOutput = Boolean(
        output?.paragraph ||
          output?.bullets?.length ||
          output?.structured?.title ||
          output?.structured?.bullets?.length ||
          output?.structured?.terms?.length,
      );
      const timeValue = job.completedAt ?? job.createdAt;
      const timeLabel = formatRelativeTime(timeValue) || job.completedAtLabel || job.createdAtLabel;
      const sortValue = timeValue;
      const sortKey = sortValue ? new Date(sortValue).getTime() : 0;
      items.push({
        key: `refine-${job.id}`,
        kind: 'refine',
        sortKey: Number.isNaN(sortKey) ? 0 : sortKey,
        job,
        hasOutput,
        timeLabel,
      });
    }
    for (const output of outputs) {
      const label = outputTypeLabelMap.get(output.type) ?? output.type;
      const sortValue = output.updatedAtRaw ?? output.createdAtRaw ?? '';
      const timeLabel =
        formatRelativeTime(sortValue) || output.createdAt || output.updatedAt || '';
      const sortKey = sortValue ? new Date(sortValue).getTime() : 0;
      const sourceNames = extractOutputSourceNames(output.content);
      const sourceTitle = formatSourceTitle(sourceNames);
      const sourcesLabel = sourceNames.length
        ? `${sourceNames.length} 个来源`
        : output.chunkIds?.length
          ? `${output.chunkIds.length} 条引用`
          : '自动检索';
      items.push({
        key: `output-${output.id}`,
        kind: 'output',
        sortKey: Number.isNaN(sortKey) ? 0 : sortKey,
        output,
        label,
        title: sourceTitle || resolveOutputTitle(output, label),
        timeLabel,
        sourcesLabel,
        hasSources: sourceNames.length > 0,
      });
    }
    return items.sort((a, b) => {
      const aPinned = a.kind === 'refine' && a.job.pinned;
      const bPinned = b.kind === 'refine' && b.job.pinned;
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return (b.sortKey || 0) - (a.sortKey || 0);
    });
  }, [jobs, mode, outputTypeLabelMap, outputs]);
  const showHistorySkeleton = outputsLoading && outputHistory.length === 0;
  const showStudioHint = isBlocked || selectedCitationCount > 0;
  const studioHint = isBlocked
    ? '请先创建笔记本后再生成输出。'
    : selectedCitationCount > 0
      ? `已选 ${selectedCitationCount} 条引用，将仅基于选中引用生成输出。`
      : '将基于当前笔记本自动检索。';

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
    const label = outputTypeLabelMap.get(output.type) ?? output.type;
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

  function handleEditOutputPrompt(type: OutputTypeId) {
    const trimmedPrompt = prompt.trim();
    const currentDefault = outputPromptMap.get(outputType);
    onSelectOutputType(type);
    if (!trimmedPrompt || (currentDefault && trimmedPrompt === currentDefault)) {
      const templatePrompt = outputPromptMap.get(type);
      if (templatePrompt) {
        onPromptChange(templatePrompt);
      }
    }
    promptRef.current?.focus();
  }

  return (
    <div className="WorkspacePanelBody">
      <div className="OutputCenterCard">
        <div className="OutputStudio">
          <div className="OutputStudioHeader">
            <div>
              <div className="OutputStudioTitle">Studio</div>
              {showStudioHint ? (
                <div className="OutputStudioSubtitle">{studioHint}</div>
              ) : null}
            </div>
            <div className="OutputStudioMeta">
              {outputs.length ? `已生成 ${outputs.length} 项` : '结构化输出'}
            </div>
          </div>
          <div className="OutputStudioGrid">
            {studioTiles.map((tile) => {
              const isDisabled = Boolean(tile.disabled || isBlocked || outputsLoading);
              const isActive = tile.type === outputType;
              const tone = resolveStudioTone((tile.type ?? tile.id) as StudioIconId);
              const menuId = `studio-${tile.id}`;
              const canOpenMenu = Boolean(tile.type) && !isDisabled;
              return (
                <div
                  key={tile.id}
                  className={`OutputStudioTile ${isDisabled ? 'isDisabled' : ''} ${
                    isActive ? 'isActive' : ''
                  }`}
                  data-tone={tone}
                >
                  <button
                    type="button"
                    className="OutputStudioTile__main"
                    disabled={isDisabled}
                    title={tile.description}
                    aria-label={
                      tile.description ? `${tile.label} ${tile.description}` : tile.label
                    }
                    onClick={() => {
                      if (!tile.type) return;
                      onGenerateOutput(tile.type);
                    }}
                  >
                    <span className="OutputStudioTile__icon">
                      {renderStudioIcon((tile.type ?? tile.id) as StudioIconId)}
                    </span>
                    <span className="OutputStudioTile__content">
                      <span className="OutputStudioTile__title">
                        {tile.label}
                        {tile.badge ? (
                          <span className="OutputStudioTile__badge">{tile.badge}</span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                  <div className="OutputStudioTile__actions">
                    <div className="OutputCardMenu" data-menu-root>
                      <button
                        type="button"
                        className="OutputStudioTile__menu"
                        aria-label={`${tile.label} 更多操作`}
                        aria-expanded={openMenuId === menuId}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!canOpenMenu) return;
                          setOpenMenuId((current) => (current === menuId ? null : menuId));
                        }}
                        disabled={!canOpenMenu}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                          <path
                            d="m4 16.5 9.4-9.4 3.5 3.5-9.4 9.4H4z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M13.4 7.1 16.9 10.6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      {openMenuId === menuId ? (
                        <div className="OutputCardMenuPanel" role="menu" data-menu-root>
                          <button
                            type="button"
                            className="OutputCardMenuItem"
                            role="menuitem"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!tile.type) return;
                              onGenerateOutput(tile.type);
                              setOpenMenuId(null);
                            }}
                            disabled={!tile.type}
                          >
                            立即生成
                          </button>
                          <button
                            type="button"
                            className="OutputCardMenuItem"
                            role="menuitem"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!tile.type) return;
                              handleEditOutputPrompt(tile.type);
                              setOpenMenuId(null);
                            }}
                            disabled={!tile.type}
                          >
                            编辑提示词
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {outputsError ? (
            <div className="WorkspaceHint isError">
              {outputsError}
              <button type="button" className="WorkspaceLinkButton" onClick={onRetryOutputs}>
                重试
              </button>
            </div>
          ) : null}
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

        <div className="OutputHistory" aria-label="输出历史">
          <div className="OutputHistoryHeader">
            <div className="OutputHistoryTitle">输出历史</div>
            <div className="OutputHistoryMeta">
              {outputsLoading
                ? '同步中...'
                : outputHistory.length
                  ? `共 ${outputHistory.length} 条`
                  : '暂无历史'}
            </div>
          </div>
          {showHistorySkeleton ? (
            <div className="OutputSkeletonList" aria-label="加载输出历史">
              <div className="OutputSkeletonItem" />
              <div className="OutputSkeletonItem isShort" />
            </div>
          ) : outputHistory.length === 0 ? (
            <div className="OutputEmpty OutputHistoryEmpty">
              <div className="OutputEmpty__icon" aria-hidden="true" />
              <div className="OutputEmpty__title">暂无输出历史</div>
              <div className="OutputEmpty__subtitle">点击上方工具或通过聊天触发输出</div>
            </div>
          ) : (
            <div className="OutputHistoryList">
              {outputHistory.map((item) => {
                if (item.kind === 'refine') {
                  const job = item.job;
                  const refineSources = extractCitationSourceNames(job.citations);
                  const refineTitle = formatSourceTitle(refineSources) || job.title;
                  const refineSourceLabel = refineSources.length
                    ? `${refineSources.length} 个来源`
                    : job.chunkIds?.length
                      ? `${job.chunkIds.length} 条引用`
                      : '自动检索';
                  const isPending = job.status === 'queued' || job.status === 'running';
                  const metaItems: { label: string; status?: RefineJob['status'] }[] = [
                    ...(job.status !== 'done'
                      ? [{ label: statusLabels[job.status], status: job.status }]
                      : []),
                    { label: refineSourceLabel },
                    { label: item.timeLabel || '刚刚生成' },
                  ];
                  return (
                    <div
                      key={item.key}
                      className={`OutputHistoryItem ${job.pinned ? 'isPinned' : ''} ${
                        isPending ? 'isLoading' : ''
                      } ${highlightedJobId === job.id ? 'isHighlighted' : ''}`}
                    >
                      <button
                        type="button"
                        className="OutputHistoryItem__main"
                        onClick={() => onReplayRefineJob(job)}
                        title="点击重新生成并入队"
                      >
                        <span
                          className="OutputHistoryItem__icon"
                          data-tone={resolveStudioTone('REFINE')}
                        >
                          {renderStudioIcon('REFINE')}
                        </span>
                        <span className="OutputHistoryItem__content">
                          <span className="OutputHistoryItem__title">{refineTitle}</span>
                          <span className="OutputHistoryItem__meta">
                            {metaItems.map((meta, index) => (
                              <span
                                key={`${item.key}-${index}`}
                                className={`OutputHistoryMetaItem${
                                  meta.status ? ` is-${meta.status}` : ''
                                }`}
                              >
                                {meta.label}
                              </span>
                            ))}
                          </span>
                        </span>
                      </button>
                      <div className="OutputHistoryItem__actions">
                        {copiedJobId === job.id ? (
                          <span className="RefineResultCard__hint">已复制</span>
                        ) : null}
                        <div className="OutputCardMenu" data-menu-root>
                          <button
                            type="button"
                            className="OutputHistoryMenuButton"
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
                                disabled={!item.hasOutput}
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
                  );
                }

                const output = item.output;
                const metaItems = [
                  { label: item.sourcesLabel },
                  { label: item.timeLabel || '刚刚生成' },
                ];
                return (
                  <div key={item.key} className="OutputHistoryItem">
                    <button
                      type="button"
                      className="OutputHistoryItem__main"
                      onClick={() => onReplayOutput(output)}
                      title="点击重新生成并入队"
                    >
                      <span
                        className="OutputHistoryItem__icon"
                        data-tone={resolveStudioTone(output.type)}
                      >
                        {renderStudioIcon(output.type)}
                      </span>
                      <span className="OutputHistoryItem__content">
                        <span className="OutputHistoryItem__title">{item.title}</span>
                        <span className="OutputHistoryItem__meta">
                          {metaItems.map((meta, index) => (
                            <span key={`${item.key}-${index}`} className="OutputHistoryMetaItem">
                              {meta.label}
                            </span>
                          ))}
                        </span>
                      </span>
                    </button>
                    <div className="OutputHistoryItem__actions">
                      {copiedOutputId === output.id ? (
                        <span className="RefineResultCard__hint">已复制</span>
                      ) : null}
                      <div className="OutputCardMenu" data-menu-root>
                        <button
                          type="button"
                          className="OutputHistoryMenuButton"
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
                );
              })}
            </div>
          )}
        </div>
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
          id="refine-prompt"
          name="refinePrompt"
          aria-label="提炼提示词"
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
    </div>
  );
}
