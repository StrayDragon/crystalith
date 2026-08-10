import type {
  Citation as WireCitation,
  Message as WireMessage,
  Notebook as WireNotebook,
  Output as WireOutput,
  OutputListItem as WireOutputListItem,
  Session as WireSession,
  Source as WireSource,
} from '@crystalith/shared';

import { decodeOutputItem, normalizeOutputPayload, pickTextValue } from './outputPayload';
import type {
  Citation,
  CitationScopeMode,
  CitationScopeSnapshot,
  ChatMessage,
  Notebook,
  OutputItem,
  RefineMode,
  RefineOutput,
  RefineTemplate,
  SessionSummary,
  SourceItem,
} from './types';

/** Loose citation fields accepted by normalize (partial / coerced wire). */
type CitationInput = Partial<{
  sourceId: number | null;
  sourceName: string | null;
  chunkId: number | string | null;
  chunkIndex: number | null;
  pageNumber: number | null;
  paragraphIndex: number | null;
  snippet: string | null;
  score: number | null;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildRefineOutput(text: string): RefineOutput {
  const normalized = text.trim();
  if (!normalized) {
    return { paragraph: '', bullets: [], structured: null, evidence: false };
  }

  const bullets = normalized
    .split(/[\n。；;]+/gu)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);

  return {
    paragraph: `已生成提炼结果（演示）：${normalized}`,
    bullets: bullets.length > 0 ? bullets : [normalized],
    structured: {
      title: normalized.slice(0, 48),
      bullets: bullets.length > 0 ? bullets : [normalized],
      terms: ['演示数据'],
    },
    evidence: true,
  };
}

/** Eden may coerce ISO wire timestamps into `Date`; UI formatters must accept both. */
export type TimestampInput = string | Date | null | undefined;

function parseTimestamp(value?: TimestampInput): Date | null {
  if (value == null || value === '') return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/** Stable ISO/string for raw caches / Date.parse — never keep a live `Date` in UI models. */
export function toTimestampRaw(value?: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
}

export function formatTimestamp(value?: TimestampInput): string {
  const parsed = parseTimestamp(value);
  if (!parsed) return '';
  return parsed.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value?: TimestampInput): string {
  const parsed = parseTimestamp(value);
  if (!parsed) return '';
  return parsed.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatRelativeTime(value?: TimestampInput): string {
  const parsed = parseTimestamp(value);
  if (!parsed) return '';
  const timestamp = parsed.getTime();
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  const days = Math.floor(diff / day);
  if (days < 30) return `${days} 天前`;
  return formatDate(parsed);
}

export function buildSourceSummaryPrompt(title?: string | null): string {
  // intentionally || — empty string is missing
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing
  const safeTitle = title?.trim() || '文档';
  return `请总结《${safeTitle}》的核心观点`;
}

export function resolveTemplateLabel(prompt: string, templates: readonly RefineTemplate[]): string {
  const normalized = prompt.trim();
  const match = templates.find((item) => item.prompt.trim() === normalized);
  return match?.label ?? '自定义';
}

export function buildJobTitle(label: string, createdAt: string): string {
  const dateLabel = formatDate(createdAt);
  return `[${label}] ${dateLabel || '未命名日期'}`;
}

export function formatOutputForCopy(
  output: RefineOutput | null | undefined,
  mode: RefineMode,
): string {
  if (!output) return '';
  if (mode === 'paragraph') return output.paragraph || '';
  if (mode === 'bullets') {
    return (output.bullets ?? []).map((item) => `- ${item}`).join('\n');
  }
  if (mode === 'structured') {
    const parts: string[] = [];
    if (output.structured?.title) parts.push(output.structured.title);
    if (output.structured?.bullets?.length) {
      parts.push(output.structured.bullets.map((item) => `- ${item}`).join('\n'));
    }
    if (output.structured?.terms?.length) {
      parts.push(`关键术语：${output.structured.terms.join('、')}`);
    }
    return parts.join('\n');
  }
  return '';
}

function formatOutputLine(text: string, depth = 0) {
  const indent = '  '.repeat(depth);
  return `${indent}${text}`;
}

type MindmapNodeLike = {
  label?: string | null;
  children?: MindmapNodeLike[] | null;
};

function formatMindmapLines(
  node: MindmapNodeLike | null | undefined,
  depth = 0,
  lines: string[] = [],
) {
  if (!node) return lines;
  // intentionally || — empty string is missing
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing
  lines.push(formatOutputLine(`- ${node.label || '未命名节点'}`, depth));
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => {
      formatMindmapLines(child, depth + 1, lines);
    });
  }
  return lines;
}

export function formatStructuredOutputForCopy(output: OutputItem): string {
  const typed = decodeOutputItem(output);
  if (!typed) return JSON.stringify(output.content ?? {}, null, 2);

  /* oxlint-disable typescript/prefer-nullish-coalescing -- copy export labels treat empty string as missing */
  switch (typed.type) {
    case 'FAQ':
      return typed.content.items
        .map((item) => `Q: ${item.question || '问题'}\nA: ${item.answer || '暂无回答'}`)
        .join('\n\n');
    case 'GUIDE':
      return typed.content.modules
        .map((module) => {
          const lines: string[] = [];
          lines.push(module.title || '模块');
          lines.push(`目标：${module.objective?.text || '暂无目标'}`);
          const keyPoints = module.keyPoints;
          if (Array.isArray(keyPoints)) {
            lines.push(...keyPoints.map((item) => formatOutputLine(`- ${item.text || '要点'}`, 0)));
          }
          return lines.join('\n');
        })
        .join('\n\n');
    case 'TIMELINE':
      return typed.content.events
        .map((event) =>
          [event.date || '时间', event.event || '事件', event.description || '暂无描述'].join(
            ' · ',
          ),
        )
        .join('\n');
    case 'MINDMAP':
      return formatMindmapLines(typed.content.root).join('\n');
    case 'QUIZ':
      return typed.content.questions
        .map((question) => {
          const lines: string[] = [];
          lines.push(question.question || '问题');
          if (Array.isArray(question.options)) {
            lines.push(...question.options.map((option) => formatOutputLine(`- ${option}`, 0)));
          }
          const answers = Array.isArray(question.answer)
            ? question.answer.join(' / ')
            : question.answer;
          lines.push(`答案：${answers || '暂无答案'}`);
          return lines.join('\n');
        })
        .join('\n\n');
    case 'BRIEFING':
      return typed.content.sections
        .map((section) => {
          const lines: string[] = [];
          lines.push(section.heading || '要点');
          if (Array.isArray(section.points)) {
            lines.push(
              ...section.points.map((point) => formatOutputLine(`- ${point.text || '内容'}`, 0)),
            );
          }
          return lines.join('\n');
        })
        .join('\n\n');
    case 'SLIDES': {
      if (typeof typed.content.markdown === 'string') {
        return typed.content.markdown;
      }
      const slides = typed.content.outline?.slides;
      if (Array.isArray(slides)) {
        const lines: string[] = [typed.content.outline?.title || '演示'];
        for (const slide of slides) {
          lines.push(slide.title || '幻灯片');
          if (Array.isArray(slide.bullets)) {
            lines.push(...slide.bullets.map((item) => formatOutputLine(`- ${item}`, 1)));
          }
        }
        return lines.join('\n');
      }
      return JSON.stringify(output.content ?? {}, null, 2);
    }
    case 'PARAGRAPH':
      return typed.content.text;
    case 'BULLETS':
      return typed.content.items.map((item) => `- ${pickTextValue(item) || '要点'}`).join('\n');
    case 'STRUCTURED': {
      const lines: string[] = [];
      lines.push(typed.content.title || '未命名结构化输出');
      if (Array.isArray(typed.content.bullets)) {
        lines.push(
          ...typed.content.bullets.map((item) =>
            formatOutputLine(`- ${pickTextValue(item) || '要点'}`, 0),
          ),
        );
      }
      if (Array.isArray(typed.content.terms) && typed.content.terms.length > 0) {
        lines.push(`关键术语：${typed.content.terms.join('、')}`);
      }
      return lines.join('\n');
    }
    default:
      return JSON.stringify(output.content ?? {}, null, 2);
  }
  /* oxlint-enable typescript/prefer-nullish-coalescing */
}

export function normalizeNotebook(row: WireNotebook): Notebook {
  return {
    id: row.id,
    title: row.name ?? '未命名笔记本',
    updatedAt: formatTimestamp(row.updatedAt ?? undefined),
    updatedAtRaw: toTimestampRaw(row.updatedAt),
  };
}

export function pickDefaultNotebookId(
  notebooks: Array<Pick<Notebook, 'id' | 'updatedAtRaw'>>,
  currentActiveId: number | null,
): number | null {
  if (notebooks.length === 0) return null;
  if (currentActiveId !== null && notebooks.some((item) => item.id === currentActiveId)) {
    return currentActiveId;
  }
  const sorted = [...notebooks].toSorted((left, right) => {
    const leftTime = left.updatedAtRaw ? Date.parse(left.updatedAtRaw) : 0;
    const rightTime = right.updatedAtRaw ? Date.parse(right.updatedAtRaw) : 0;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return right.id - left.id;
  });
  return sorted[0]?.id ?? null;
}

export function normalizeSession(row: WireSession): SessionSummary {
  return {
    id: row.id,
    title: row.title ?? '未命名会话',
    createdAt: formatTimestamp(row.createdAt ?? undefined),
    updatedAt: formatTimestamp(row.updatedAt ?? undefined),
  };
}

export function normalizeMessage(row: WireMessage): ChatMessage {
  const citations = Array.isArray(row.citations) ? row.citations.map(normalizeCitation) : [];
  const role = row.role === 'assistant' ? 'assistant' : 'user';
  return {
    id: `${row.id}`,
    role,
    content: row.content ?? '',
    citations,
    citationChunkIds: collectChunkIds(citations ?? []),
    citationScope: role === 'assistant' ? buildCitationScopeSnapshot(citations, 'auto') : undefined,
  };
}

export function normalizeOutput(
  row: WireOutput | (WireOutputListItem & Partial<WireOutput>),
): OutputItem {
  const hasContent = 'content' in row && row.content !== undefined && row.content !== null;
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt ?? '',
    chunkIds: row.chunkIds ?? [],
    content: hasContent ? normalizeOutputPayload(row.type, row.content) : null,
    contentLoaded: hasContent,
    title: 'title' in row ? (row.title ?? null) : null,
    preview: 'preview' in row ? (row.preview ?? null) : null,
    slideId: 'slideId' in row ? (row.slideId ?? null) : null,
    researchLab:
      'researchLab' in row && row.researchLab
        ? {
            notebookId: row.researchLab.notebookId,
            runId: row.researchLab.runId,
            ...(row.researchLab.artifactKind ? { artifactKind: row.researchLab.artifactKind } : {}),
          }
        : null,
    createdAt: formatTimestamp(row.createdAt ?? undefined),
    updatedAt: formatTimestamp(row.updatedAt ?? undefined),
    createdAtRaw: toTimestampRaw(row.createdAt),
    updatedAtRaw: toTimestampRaw(row.updatedAt),
  };
}

/** Merge list refresh with cached detail bodies (c72). */
export function mergeOutputListWithCache(
  listRows: Array<WireOutputListItem | WireOutput>,
  existing: OutputItem[],
): OutputItem[] {
  const byId = new Map(existing.map((item) => [item.id, item]));
  return listRows.map((row) => {
    const next = normalizeOutput({ ...row });
    const prev = byId.get(next.id);
    if (prev?.contentLoaded && prev.content != null) {
      return {
        ...next,
        content: prev.content,
        contentLoaded: true,
        // Prefer list title/slideId when present; keep prior slideId if list omitted
        title: next.title ?? prev.title,
        slideId: next.slideId ?? prev.slideId,
      };
    }
    return next;
  });
}

export function formatSourceType(row: Pick<WireSource, 'filename' | 'mimeType'>): string {
  const filename = row.filename ?? '';
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'md' || extension === 'markdown') return 'Markdown';
  if (extension === 'txt') return 'TXT';
  if (row.mimeType === 'text/markdown') return 'Markdown';
  if (row.mimeType === 'text/plain') return 'TXT';
  // intentionally || — empty mime type is missing
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing
  return row.mimeType || '未知';
}

export function normalizeSource(row: WireSource): SourceItem {
  const statusKey = (row.status ?? 'READY').toUpperCase();
  const metadata = isRecord(row.metadata) ? row.metadata : null;
  const rawIndexProgress = metadata?.index_progress;
  const indexProgress =
    typeof rawIndexProgress === 'number' && Number.isFinite(rawIndexProgress)
      ? rawIndexProgress
      : null;
  const statusLabel =
    {
      READY: '已索引',
      PROCESSING: '处理中',
      FAILED: '失败',
    }[statusKey] ??
    row.status ??
    '未知';

  return {
    id: row.id,
    title: row.filename ?? '未命名文件',
    type: formatSourceType(row),
    status: statusLabel,
    statusTone: statusKey,
    errorCode: typeof row.errorCode === 'string' && row.errorCode ? row.errorCode : null,
    errorMessage:
      typeof row.errorMessage === 'string' && row.errorMessage ? row.errorMessage : null,
    recoveryHint:
      typeof row.recoveryHint === 'string' && row.recoveryHint ? row.recoveryHint : null,
    lastErrorAt: toTimestampRaw(row.lastErrorAt) ?? null,
    indexProgress,
    chunks: row.chunkCount ?? 0,
    tags: Array.isArray(row.tags)
      ? row.tags.filter((tag): tag is string => typeof tag === 'string' && tag.length > 0)
      : [],
    createdAt: formatTimestamp(row.createdAt ?? undefined),
    createdAtRaw: toTimestampRaw(row.createdAt),
  };
}

export function normalizeCitation(row: CitationInput | WireCitation): Citation {
  const chunkId = row.chunkId != null ? Number(row.chunkId) : null;
  return {
    id: `${row.chunkId ?? row.chunkIndex ?? ''}`,
    chunkId: Number.isFinite(chunkId) ? chunkId : null,
    sourceId: row.sourceId ?? null,
    sourceName: row.sourceName ?? '未知来源',
    snippet: row.snippet ?? '',
    chunkIndex: row.chunkIndex ?? 0,
    pageNumber: row.pageNumber ?? null,
    paragraphIndex: row.paragraphIndex ?? null,
    score: row.score ?? undefined,
  };
}

export function collectChunkIds(citations: Citation[]): number[] {
  return (citations ?? [])
    .map((citation) => citation.chunkId)
    .filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0,
    );
}

export function collectOutputCitations(content: unknown): Citation[] {
  const seen = new Map<number, Citation>();
  const pushCitation = (raw: unknown) => {
    if (!isRecord(raw)) return;
    const chunkId = typeof raw.chunkId === 'number' ? raw.chunkId : null;
    if (!chunkId || seen.has(chunkId)) return;
    const mapped: CitationInput = {
      sourceId: typeof raw.sourceId === 'number' ? raw.sourceId : null,
      sourceName: typeof raw.sourceName === 'string' ? raw.sourceName : null,
      chunkId,
      chunkIndex: typeof raw.chunkIndex === 'number' ? raw.chunkIndex : null,
      pageNumber: typeof raw.pageNumber === 'number' ? raw.pageNumber : null,
      paragraphIndex: typeof raw.paragraphIndex === 'number' ? raw.paragraphIndex : null,
      snippet: typeof raw.snippet === 'string' ? raw.snippet : null,
      score: typeof raw.score === 'number' ? raw.score : null,
    };
    const normalized = normalizeCitation(mapped);
    seen.set(chunkId, normalized);
  };
  const walk = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!isRecord(value)) return;
    if (Array.isArray(value.citations)) {
      value.citations.forEach(pushCitation);
    }
    Object.values(value).forEach(walk);
  };
  walk(content);
  return Array.from(seen.values());
}

export function buildCitationScopeSnapshot(
  citations: Citation[],
  mode: CitationScopeMode,
): CitationScopeSnapshot {
  const sources = Array.from(
    new Set(
      (citations ?? [])
        .map((citation) => citation.sourceName)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  return {
    mode,
    kind: 'citations',
    count: citations?.length ?? 0,
    sources,
  };
}

export function buildSourceScopeSnapshot(
  sources: string[],
  mode: CitationScopeMode,
): CitationScopeSnapshot {
  return {
    mode,
    kind: 'sources',
    count: sources.length,
    sources,
  };
}
