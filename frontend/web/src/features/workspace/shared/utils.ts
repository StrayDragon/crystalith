import type {
  ApiCitation,
  ApiMessage,
  ApiNotebook,
  ApiOutput,
  ApiSession,
  ApiSource,
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

export function formatRelativeTime(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  const timestamp = parsed.getTime();
  if (Number.isNaN(timestamp)) return '';
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  const days = Math.floor(diff / day);
  if (days < 30) return `${days} 天前`;
  return formatDate(value);
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

function formatOutputLine(text: string, depth = 0) {
  const indent = '  '.repeat(depth);
  return `${indent}${text}`;
}

function formatMindmapLines(
  node: { label?: string; children?: any[] } | null | undefined,
  depth = 0,
  lines: string[] = [],
) {
  if (!node) return lines;
  lines.push(formatOutputLine(`- ${node.label || '未命名节点'}`, depth));
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => formatMindmapLines(child, depth + 1, lines));
  }
  return lines;
}

export function formatStructuredOutputForCopy(output: OutputItem): string {
  const content = output.content ?? {};
  if (output.type === 'FAQ' && Array.isArray((content as any).items)) {
    return (content as any).items
      .map((item: any) => `Q: ${item.question || '问题'}\nA: ${item.answer || '暂无回答'}`)
      .join('\n\n');
  }
  if (output.type === 'GUIDE' && Array.isArray((content as any).modules)) {
    return (content as any).modules
      .map((module: any) => {
        const lines: string[] = [];
        lines.push(module.title || '模块');
        lines.push(`目标：${module.objective?.text || '暂无目标'}`);
        if (Array.isArray(module.key_points)) {
          lines.push(
            ...module.key_points.map((item: any) => formatOutputLine(`- ${item.text || '要点'}`, 0)),
          );
        }
        return lines.join('\n');
      })
      .join('\n\n');
  }
  if (output.type === 'TIMELINE' && Array.isArray((content as any).events)) {
    return (content as any).events
      .map((event: any) =>
        [event.date || '时间', event.event || '事件', event.description || '暂无描述'].join(' · '),
      )
      .join('\n');
  }
  if (output.type === 'MINDMAP' && (content as any).root) {
    return formatMindmapLines((content as any).root).join('\n');
  }
  if (output.type === 'QUIZ' && Array.isArray((content as any).questions)) {
    return (content as any).questions
      .map((question: any) => {
        const lines: string[] = [];
        lines.push(question.question || '问题');
        if (Array.isArray(question.options)) {
          lines.push(
            ...question.options.map((option: string) => formatOutputLine(`- ${option}`, 0)),
          );
        }
        lines.push(`答案：${question.answer || '暂无答案'}`);
        return lines.join('\n');
      })
      .join('\n\n');
  }
  if (output.type === 'BRIEFING' && Array.isArray((content as any).sections)) {
    return (content as any).sections
      .map((section: any) => {
        const lines: string[] = [];
        lines.push(section.heading || '要点');
        if (Array.isArray(section.points)) {
          lines.push(
            ...section.points.map((point: any) => formatOutputLine(`- ${point.text || '内容'}`, 0)),
          );
        }
        return lines.join('\n');
      })
      .join('\n\n');
  }
  if (output.type === 'SLIDES') {
    if (typeof (content as any).markdown === 'string') {
      return (content as any).markdown;
    }
    if ((content as any).outline && Array.isArray((content as any).outline.slides)) {
      const outline = (content as any).outline;
      const lines: string[] = [outline.title || '演示'];
      for (const slide of outline.slides) {
        lines.push(slide.title || '幻灯片');
        if (Array.isArray(slide.bullets)) {
          lines.push(...slide.bullets.map((item: string) => formatOutputLine(`- ${item}`, 1)));
        }
      }
      return lines.join('\n');
    }
  }
  if (output.type === 'PARAGRAPH' && typeof (content as any).text === 'string') {
    return (content as any).text;
  }
  if (output.type === 'BULLETS' && Array.isArray((content as any).items)) {
    return (content as any).items
      .map((item: any) => `- ${item.text || '要点'}`)
      .join('\n');
  }
  if (output.type === 'STRUCTURED') {
    const lines: string[] = [];
    lines.push((content as any).title || '未命名结构化输出');
    if (Array.isArray((content as any).bullets)) {
      lines.push(
        ...((content as any).bullets as any[]).map((item: any) =>
          formatOutputLine(`- ${item.text || '要点'}`, 0),
        ),
      );
    }
    if (Array.isArray((content as any).terms) && (content as any).terms.length > 0) {
      lines.push(`关键术语：${(content as any).terms.join('、')}`);
    }
    return lines.join('\n');
  }
  return JSON.stringify(output.content ?? {}, null, 2);
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
  const citations = Array.isArray(row.citations)
    ? row.citations.map(normalizeCitation)
    : [];
  const role = row.role === 'assistant' ? 'assistant' : 'user';
  return {
    id: `${row.id}`,
    role,
    content: row.content ?? '',
    citations,
    citationChunkIds: collectChunkIds(citations ?? []),
    citationScope:
      role === 'assistant' ? buildCitationScopeSnapshot(citations, 'auto') : undefined,
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
    createdAtRaw: row.created_at ?? undefined,
    updatedAtRaw: row.updated_at ?? undefined,
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
    sourceId: row.source_id ?? null,
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

export function collectOutputCitations(content: unknown): Citation[] {
  const seen = new Map<number, Citation>();
  const pushCitation = (raw: unknown) => {
    if (!raw || typeof raw !== 'object') return;
    const record = raw as Record<string, unknown>;
    const chunkId =
      typeof record.chunk_id === 'number'
        ? record.chunk_id
        : typeof record.chunkId === 'number'
          ? record.chunkId
          : null;
    if (!chunkId || seen.has(chunkId)) return;
    const mapped = {
      source_id: record.source_id ?? record.sourceId,
      source_name: record.source_name ?? record.sourceName,
      chunk_id: record.chunk_id ?? record.chunkId,
      chunk_index: record.chunk_index ?? record.chunkIndex,
      page_number: record.page_number ?? record.pageNumber,
      paragraph_index: record.paragraph_index ?? record.paragraphIndex,
      snippet: record.snippet,
      score: record.score,
    } as ApiCitation;
    const normalized = normalizeCitation(mapped);
    if (normalized.chunkId && !seen.has(normalized.chunkId)) {
      seen.set(normalized.chunkId, normalized);
    }
  };
  const walk = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.citations)) {
      record.citations.forEach(pushCitation);
    }
    Object.values(record).forEach(walk);
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
        .map((citation) => citation.sourceTitle)
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
