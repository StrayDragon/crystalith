import { useMemo } from 'react';

import type { OutputItem, OutputTypeId, WorkspaceTool } from '../types';
import { formatRelativeTime } from '../utils';

interface StudioPanelProps {
  tools: WorkspaceTool[];
  outputs: OutputItem[];
  outputsLoading: boolean;
  outputsError: string;
  onRetryOutputs: () => void;
  onGenerateOutput: (type?: OutputTypeId) => void;
  onSelectOutput: (outputId: number) => void;
  recentOutputJobId: string | null;
  isDemo: boolean;
}

type StudioTone = 'slate' | 'blue' | 'green' | 'rose' | 'amber' | 'teal' | 'indigo';

type StudioNote = {
  id: string;
  outputId?: number;
  title: string;
  meta: string;
  type: OutputTypeId;
};

const DEFAULT_TYPE_LABELS: Record<OutputTypeId, string> = {
  FAQ: '闪卡',
  GUIDE: '指南',
  TIMELINE: '时间轴',
  MINDMAP: '思维导图',
  QUIZ: '测验',
  BRIEFING: '报告',
  PARAGRAPH: '段落',
  BULLETS: '要点',
  STRUCTURED: '结构化',
};

const DEMO_NOTES: StudioNote[] = [
  {
    id: 'demo-1',
    title: '米诺地尔治疗脱发（激素抵抗性脱发）的研究总结与临...',
    meta: '39 个来源 · 3 天前',
    type: 'BRIEFING',
  },
  {
    id: 'demo-2',
    title: '脱发问答',
    meta: '39 个来源 · 6 天前',
    type: 'FAQ',
  },
  {
    id: 'demo-3',
    title: 'AGA 现代图景 或者 AGA Modern Landscape',
    meta: '39 个来源 · 7 天前',
    type: 'MINDMAP',
  },
  {
    id: 'demo-4',
    title: 'Eating for Healthier Hair: A Practical Guide to Key...',
    meta: '39 个来源 · 7 天前',
    type: 'GUIDE',
  },
  {
    id: 'demo-5',
    title: '雄激素脱发：脱发与治疗',
    meta: '39 个来源 · 7 天前',
    type: 'TIMELINE',
  },
  {
    id: 'demo-6',
    title: '雄激素性脱发：机制和新治疗',
    meta: '39 个来源 · 7 天前',
    type: 'QUIZ',
  },
];

function resolveOutputTitle(output: OutputItem): string {
  const content = output.content ?? {};
  const contentTitle = typeof (content as any).title === 'string' ? (content as any).title.trim() : '';
  if (contentTitle) return contentTitle;
  const promptTitle = output.prompt?.trim();
  if (promptTitle) return promptTitle;
  return `${output.type} 输出`;
}

function resolveNoteMeta(output: OutputItem): string {
  const count = output.chunkIds?.length ?? 0;
  const relative =
    formatRelativeTime(output.createdAtRaw ?? output.updatedAtRaw) ||
    output.createdAt ||
    output.updatedAt ||
    '刚刚';
  if (count > 0) {
    return `${count} 个来源 · ${relative}`;
  }
  return `自动生成 · ${relative}`;
}

function resolveTone(type: OutputTypeId): StudioTone {
  switch (type) {
    case 'MINDMAP':
      return 'indigo';
    case 'BRIEFING':
      return 'amber';
    case 'FAQ':
      return 'blue';
    case 'QUIZ':
      return 'teal';
    case 'GUIDE':
      return 'green';
    case 'TIMELINE':
      return 'rose';
    default:
      return 'slate';
  }
}

function resolveTypeLabel(type: OutputTypeId, labels: Map<OutputTypeId, string>) {
  return labels.get(type) ?? DEFAULT_TYPE_LABELS[type];
}

function renderToolIcon(type: OutputTypeId) {
  switch (type) {
    case 'MINDMAP':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="6" cy="6" r="2" fill="currentColor" />
          <circle cx="18" cy="6" r="2" fill="currentColor" />
          <circle cx="12" cy="18" r="2" fill="currentColor" />
          <path
            d="M8 6h8M12 8v7M9.5 15.5 12 18l2.5-2.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case 'BRIEFING':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M7 5h7l3 3v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
          <path d="M14 5v3h3" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'FAQ':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="6" y="6" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="M9 9h6M9 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'QUIZ':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="m9 12.5 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'GUIDE':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M6 6h8a3 3 0 0 1 3 3v9a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3V9a3 3 0 0 1 3-3Z"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
          <path d="M8 9h6M8 12h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'TIMELINE':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

function renderNoteIcon(type: OutputTypeId) {
  return (
    renderToolIcon(type) ?? (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M7 5h7l3 3v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
        />
        <path d="M14 5v3h3" stroke="currentColor" strokeWidth="1.4" fill="none" />
      </svg>
    )
  );
}

export default function StudioPanel({
  tools,
  outputs,
  outputsLoading,
  outputsError,
  onRetryOutputs,
  onGenerateOutput,
  onSelectOutput,
  recentOutputJobId,
  isDemo,
}: StudioPanelProps) {
  const typeLabelMap = useMemo(() => {
    const map = new Map<OutputTypeId, string>();
    tools.forEach((tool) => {
      map.set(tool.outputType, tool.label);
    });
    return map;
  }, [tools]);

  const outputNotes = useMemo<StudioNote[]>(
    () =>
      outputs.map((output) => ({
        id: `${output.id}`,
        outputId: output.id,
        title: resolveOutputTitle(output),
        meta: resolveNoteMeta(output),
        type: output.type,
      })),
    [outputs],
  );

  const notes = outputNotes.length > 0 ? outputNotes : isDemo ? DEMO_NOTES : [];

  return (
    <div className="WorkspacePanelBody StudioBody">
      <div className="StudioGrid" role="list">
        {tools.map((tool, index) => {
          const isDisabled = !tool.enabled || !tool.outputType;
          return (
            <button
              key={tool.id}
              type="button"
              className={`StudioTile ${isDisabled ? 'isDisabled' : ''}`}
              data-tone={tool.tone}
              style={{ animationDelay: `${index * 40}ms` }}
              onClick={() => {
                if (isDisabled) return;
                onGenerateOutput(tool.outputType);
              }}
              disabled={isDisabled}
              aria-label={tool.badge ? `${tool.label} ${tool.badge}` : tool.label}
              title={tool.description}
            >
              <span className="StudioTile__icon" aria-hidden="true">
                {renderToolIcon(tool.outputType)}
              </span>
              <span className="StudioTile__label">
                <span className="StudioTile__labelText">{tool.label}</span>
                {tool.badge ? <span className="StudioTile__badge">{tool.badge}</span> : null}
              </span>
              <span className="StudioTile__edit" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path
                    d="M6 16.5V18h1.5l7.9-7.9-1.5-1.5L6 16.5Zm9.9-9.9 1.5 1.5 1-1a1 1 0 0 0 0-1.5l-.5-.5a1 1 0 0 0-1.5 0l-1 1Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
            </button>
          );
        })}
      </div>

      <div className="StudioNotes">
        {recentOutputJobId ? (
          <div className="StudioNotice" role="status">
            已生成新的笔记，已加入列表。
          </div>
        ) : null}
        {outputsLoading ? (
          <div className="StudioSkeletonList" aria-label="加载笔记">
            <div className="StudioSkeletonItem" />
            <div className="StudioSkeletonItem isShort" />
          </div>
        ) : notes.length === 0 ? (
          <div className="StudioEmpty">暂无笔记</div>
        ) : (
          <div className="StudioNoteList">
            {notes.map((note) => {
              const tone = resolveTone(note.type);
              const typeLabel = resolveTypeLabel(note.type, typeLabelMap);
              return (
                <div key={note.id} className="StudioNoteItem">
                  <button
                    type="button"
                    className="StudioNoteButton"
                    onClick={() => {
                      if (!note.outputId) return;
                      onSelectOutput(note.outputId);
                    }}
                    aria-disabled={!note.outputId}
                  >
                    <span className="StudioNoteIcon" data-tone={tone} aria-hidden="true">
                      {renderNoteIcon(note.type)}
                    </span>
                    <span className="StudioNoteContent">
                      <span className="StudioNoteTitleRow">
                        <span className="StudioNoteTitle">{note.title}</span>
                        <span className="StudioNoteType">{typeLabel}</span>
                      </span>
                      <span className="StudioNoteMeta">{note.meta}</span>
                    </span>
                  </button>
                  <button type="button" className="StudioNoteMenu" aria-label="更多操作">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {outputsError ? (
          <div className="WorkspaceHint isError">
            {outputsError}
            <button type="button" className="WorkspaceLinkButton" onClick={onRetryOutputs}>
              重试
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="StudioAddButton"
        onClick={() => onGenerateOutput('BRIEFING')}
      >
        添加笔记
      </button>
    </div>
  );
}
