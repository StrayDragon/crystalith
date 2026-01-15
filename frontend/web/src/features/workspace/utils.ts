import type {
  ApiCitation,
  ApiMessage,
  ApiNotebook,
  ApiOutput,
  ApiSession,
  ApiSource,
  Citation,
  ChatMessage,
  Notebook,
  OutputItem,
  RefineMode,
  RefineOutput,
  RefineTemplate,
  SessionSummary,
  SourceItem,
} from './types';

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildRefineOutput(text: string): RefineOutput {
  const normalized = text.trim();
  if (!normalized) {
    return { paragraph: '', bullets: [], structured: null, evidence: false };
  }

  const bullets = normalized
    .split(/[\n。；;]+/g)
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

export function formatTimestamp(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function buildSourceSummaryPrompt(title?: string | null): string {
  const safeTitle = title?.trim() || '文档';
  return `请总结《${safeTitle}》的核心观点`;
}

export function resolveTemplateLabel(prompt: string, templates: RefineTemplate[]): string {
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

export function normalizeNotebook(row: ApiNotebook): Notebook {
  return {
    id: Number(row.id),
    title: row.name ?? '未命名笔记本',
    updatedAt: formatTimestamp(row.updated_at ?? undefined),
  };
}

export function normalizeSession(row: ApiSession): SessionSummary {
  return {
    id: Number(row.id),
    title: row.title ?? '未命名会话',
    createdAt: formatTimestamp(row.created_at ?? undefined),
    updatedAt: formatTimestamp(row.updated_at ?? undefined),
  };
}

export function normalizeMessage(row: ApiMessage): ChatMessage {
  const citations = Array.isArray(row.citations?.items)
    ? row.citations?.items?.map(normalizeCitation)
    : [];
  return {
    id: `${row.id}`,
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content ?? '',
    citations,
    citationChunkIds: collectChunkIds(citations ?? []),
  };
}

export function normalizeOutput(row: ApiOutput): OutputItem {
  return {
    id: Number(row.id),
    type: row.type,
    prompt: row.prompt ?? '',
    chunkIds: row.chunk_ids ?? [],
    content: row.content ?? {},
    createdAt: formatTimestamp(row.created_at ?? undefined),
    updatedAt: formatTimestamp(row.updated_at ?? undefined),
  };
}

export function formatSourceType(row: ApiSource): string {
  const filename = row.filename ?? '';
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'md' || extension === 'markdown') return 'Markdown';
  if (extension === 'txt') return 'TXT';
  if (row.mime_type === 'text/markdown') return 'Markdown';
  if (row.mime_type === 'text/plain') return 'TXT';
  return row.mime_type || '未知';
}

export function normalizeSource(row: ApiSource): SourceItem {
  const statusKey = String(row.status ?? 'READY').toUpperCase();
  const statusLabel =
    {
      READY: '已索引',
      PROCESSING: '处理中',
      FAILED: '失败',
    }[statusKey] ??
    row.status ??
    '未知';

  return {
    id: Number(row.id),
    title: row.filename ?? '未命名文件',
    type: formatSourceType(row),
    status: statusLabel,
    statusTone: statusKey,
    chunks: row.chunk_count ?? 0,
  };
}

export function normalizeCitation(row: ApiCitation): Citation {
  const chunkId = row.chunk_id != null ? Number(row.chunk_id) : null;
  return {
    id: `${row.chunk_id ?? row.chunk_index ?? ''}`,
    chunkId: Number.isFinite(chunkId) ? chunkId : null,
    sourceTitle: row.source_name ?? '未知来源',
    snippet: row.snippet ?? '',
    chunkIndex: row.chunk_index ?? 0,
    pageNumber: row.page_number ?? null,
    paragraphIndex: row.paragraph_index ?? null,
    score: row.score ?? undefined,
  };
}

export function collectChunkIds(citations: Citation[]): number[] {
  return (citations ?? [])
    .map((citation) => citation.chunkId)
    .filter((value): value is number => Number.isFinite(value) && value > 0);
}
