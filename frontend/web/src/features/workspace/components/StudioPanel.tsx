import { useMemo } from 'react';

import type { OutputItem, OutputTypeId } from '../types';
import { formatRelativeTime } from '../utils';

interface StudioPanelProps {
  outputs: OutputItem[];
  outputsLoading: boolean;
  outputsError: string;
  onRetryOutputs: () => void;
  onGenerateOutput: (type?: OutputTypeId) => void;
  isDemo: boolean;
}

type StudioTone = 'slate' | 'blue' | 'green' | 'rose' | 'amber' | 'teal' | 'indigo';

type StudioTool = {
  id: string;
  label: string;
  tone: StudioTone;
  badge?: string;
  outputType?: OutputTypeId;
  disabled?: boolean;
};

type StudioNote = {
  id: string;
  title: string;
  meta: string;
  tone: StudioTone;
};

const TOOLS: StudioTool[] = [
  { id: 'audio', label: '音频概览', tone: 'blue', disabled: true },
  { id: 'video', label: '视频概览', tone: 'green', disabled: true },
  { id: 'mindmap', label: '思维导图', tone: 'indigo', outputType: 'MINDMAP' },
  { id: 'report', label: '报告', tone: 'amber', outputType: 'BRIEFING' },
  { id: 'flashcards', label: '闪卡', tone: 'rose', outputType: 'FAQ' },
  { id: 'quiz', label: '测验', tone: 'teal', outputType: 'QUIZ' },
  { id: 'infographic', label: '信息图', tone: 'slate', badge: 'Beta 版', disabled: true },
  { id: 'slides', label: '演示文稿', tone: 'blue', badge: 'Beta 版', disabled: true },
  { id: 'data-table', label: '数据表格', tone: 'green', badge: 'Beta 版', disabled: true },
];

const DEMO_NOTES: StudioNote[] = [
  {
    id: 'demo-1',
    title: '米诺地尔治疗脱发（激素抵抗性脱发）的研究总结与临...',
    meta: '39 个来源 · 3 天前',
    tone: 'amber',
  },
  {
    id: 'demo-2',
    title: '脱发问答',
    meta: '39 个来源 · 6 天前',
    tone: 'blue',
  },
  {
    id: 'demo-3',
    title: 'AGA 现代图景 或者 AGA Modern Landscape',
    meta: '39 个来源 · 7 天前',
    tone: 'slate',
  },
  {
    id: 'demo-4',
    title: 'Eating for Healthier Hair: A Practical Guide to Key...',
    meta: '39 个来源 · 7 天前',
    tone: 'green',
  },
  {
    id: 'demo-5',
    title: '雄激素脱发：脱发与治疗',
    meta: '39 个来源 · 7 天前',
    tone: 'rose',
  },
  {
    id: 'demo-6',
    title: '雄激素性脱发：机制和新治疗',
    meta: '39 个来源 · 7 天前',
    tone: 'indigo',
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

function renderToolIcon(id: string) {
  switch (id) {
    case 'audio':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M6 14v-4M10 17V7M14 19V5M18 15v-6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'video':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="5" y="7" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="m11 10 4 2-4 2z" fill="currentColor" />
        </svg>
      );
    case 'mindmap':
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
    case 'report':
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
    case 'flashcards':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="6" y="6" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="M9 9h6M9 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'quiz':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="m9 12.5 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'infographic':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 18V9M12 18V6M18 18v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="6" cy="7" r="1.5" fill="currentColor" />
          <circle cx="12" cy="4" r="1.5" fill="currentColor" />
          <circle cx="18" cy="12" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'slides':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="5" y="6" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="M9 10h6M9 13h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'data-table':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="5" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="M5 10h14M9 6v12M15 6v12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default function StudioPanel({
  outputs,
  outputsLoading,
  outputsError,
  onRetryOutputs,
  onGenerateOutput,
  isDemo,
}: StudioPanelProps) {
  const outputNotes = useMemo<StudioNote[]>(
    () =>
      outputs.map((output) => ({
        id: `${output.id}`,
        title: resolveOutputTitle(output),
        meta: resolveNoteMeta(output),
        tone: resolveTone(output.type),
      })),
    [outputs],
  );

  const notes = outputNotes.length > 0 ? outputNotes : isDemo ? DEMO_NOTES : [];

  return (
    <div className="WorkspacePanelBody StudioBody">
      <div className="StudioGrid" role="list">
        {TOOLS.map((tool, index) => {
          const isDisabled = Boolean(tool.disabled) || !tool.outputType;
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
            >
              <span className="StudioTile__icon" aria-hidden="true">
                {renderToolIcon(tool.id)}
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
        {outputsLoading ? (
          <div className="StudioSkeletonList" aria-label="加载笔记">
            <div className="StudioSkeletonItem" />
            <div className="StudioSkeletonItem isShort" />
          </div>
        ) : notes.length === 0 ? (
          <div className="StudioEmpty">暂无笔记</div>
        ) : (
          <div className="StudioNoteList">
            {notes.map((note) => (
              <div key={note.id} className="StudioNoteItem">
                <button type="button" className="StudioNoteButton">
                  <span className="StudioNoteIcon" data-tone={note.tone} aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path
                        d="M7 5h7l3 3v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        fill="none"
                      />
                      <path d="M14 5v3h3" stroke="currentColor" strokeWidth="1.4" fill="none" />
                    </svg>
                  </span>
                  <span className="StudioNoteContent">
                    <span className="StudioNoteTitle">{note.title}</span>
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
            ))}
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
