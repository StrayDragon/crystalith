// Source auto-summary: cache in sources.metadata.autoSummary.
// GET is side-effect free; POST / async-after-ready generate & persist.
import type { SourceSummary } from '@crystalith/shared';
import { generateText } from 'ai';
import { eq } from 'drizzle-orm';
import { NotFoundError } from 'elysia';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { chunks, sources } from '../../db/schema.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';

export const AUTO_SUMMARY_KEY = 'autoSummary';

export interface AutoSummaryCache {
  summary: string;
  keyPoints: string[];
  topics: string[];
  wordCount: number;
  generatedAt: string;
}

type SourceRow = typeof sources.$inferSelect;

function asMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) };
  }
  return {};
}

function isAutoSummaryCache(value: unknown): value is AutoSummaryCache {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.summary === 'string' &&
    Array.isArray(v.keyPoints) &&
    Array.isArray(v.topics) &&
    typeof v.wordCount === 'number' &&
    typeof v.generatedAt === 'string'
  );
}

/** Parse LLM text — mirrors v1 api_summary.py:36 */
export function parseSummaryResponse(response: string): {
  summary: string;
  keyPoints: string[];
  topics: string[];
} {
  const lines = response.trim().split('\n');
  let summary = '';
  const keyPoints: string[] = [];
  const topics: string[] = [];
  let section: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('摘要：') || line.startsWith('摘要:')) {
      summary = line.split(/[：:]/u, 2)[1]?.trim() ?? '';
      section = 'summary';
    } else if (line.startsWith('要点：') || line.startsWith('要点:')) {
      section = 'points';
    } else if (line.startsWith('主题：') || line.startsWith('主题:')) {
      const topicsStr = line.split(/[：:]/u, 2)[1]?.trim() ?? '';
      for (const t of topicsStr.replaceAll(/[、,]/gu, ',').split(',')) {
        const trimmed = t.trim();
        if (trimmed) topics.push(trimmed);
      }
      section = 'topics';
    } else if (line.startsWith('- ') && section === 'points') {
      keyPoints.push(line.slice(2).trim());
    } else if (section === 'summary' && !summary) {
      summary = line;
    }
  }

  return {
    summary: summary || response.slice(0, 200).trim(),
    keyPoints:
      keyPoints.length > 0
        ? keyPoints.slice(0, 4)
        : ['核心概念和定义', '主要方法论', '实践案例分析', '建议和最佳实践'],
    topics: topics.length > 0 ? topics.slice(0, 3) : ['分析', '方法论', '实践'],
  };
}

function requireReadySource(nid: number, sid: number): SourceRow {
  const source = db().select().from(sources).where(eq(sources.id, sid)).get();
  if (!source) throw new NotFoundError(`Source ${sid} not found`);
  if (source.notebookId !== nid) throw new NotFoundError(`Source ${sid} not found`);
  if (source.status !== 'ready') {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'Source is not ready');
  }
  return source;
}

function loadChunkTexts(sid: number): { texts: string[]; wordCount: number } {
  const chunkRows = db()
    .select()
    .from(chunks)
    .where(eq(chunks.sourceId, sid))
    .orderBy(chunks.chunkIndex)
    .all();
  if (chunkRows.length === 0) throw new NotFoundError('Source has no content');
  const texts = chunkRows.map((c) => c.text);
  const wordCount = texts.join(' ').split(/\s+/u).length;
  return { texts, wordCount };
}

function toWire(sid: number, cache: AutoSummaryCache): SourceSummary {
  return {
    sourceId: sid,
    summary: cache.summary,
    keyPoints: cache.keyPoints,
    topics: cache.topics,
    wordCount: cache.wordCount,
    generatedAt: cache.generatedAt,
  };
}

function emptyWire(sid: number, wordCount: number): SourceSummary {
  return {
    sourceId: sid,
    summary: '',
    keyPoints: [],
    topics: [],
    wordCount,
    generatedAt: null,
  };
}

function readCached(source: SourceRow): AutoSummaryCache | null {
  const meta = asMetadataRecord(source.metadata);
  const cached = meta[AUTO_SUMMARY_KEY];
  return isAutoSummaryCache(cached) ? cached : null;
}

function mergeAutoSummary(sourceId: number, cache: AutoSummaryCache): void {
  const row = db().select().from(sources).where(eq(sources.id, sourceId)).get();
  if (!row) return;
  const next = asMetadataRecord(row.metadata);
  next[AUTO_SUMMARY_KEY] = cache;
  db().update(sources).set({ metadata: next }).where(eq(sources.id, sourceId)).run();
}

async function generateSummaryPayload(
  source: SourceRow,
  texts: string[],
  wordCount: number,
): Promise<AutoSummaryCache> {
  const context = texts
    .slice(0, 10)
    .map((t, i) => `[片段 ${i + 1}]\n${t}`)
    .join('\n\n');

  const modelConfig = getDefaultChatModel();
  if (modelConfig) {
    try {
      const model = withRetry(await resolveModel(modelConfig));
      const { text } = await generateText({
        model,
        abortSignal: AbortSignal.timeout(30_000),
        system:
          '你是一个文档摘要助手。请根据提供的文档内容生成：1. 一段简洁的摘要（2-3句话）2. 4个关键要点（每个要点一句话）3. 3个主题标签。请用中文回复，格式如下：\n摘要：<摘要内容>\n要点：\n- <要点1>\n- <要点2>\n- <要点3>\n- <要点4>\n主题：<主题1>、<主题2>、<主题3>',
        prompt: `请为以下文档「${source.filename}」生成摘要：\n\n${context}`,
      });
      const parsed = parseSummaryResponse(text);
      return {
        ...parsed,
        wordCount,
        generatedAt: new Date().toISOString(),
      };
    } catch {
      // fall through to template
    }
  }

  return {
    summary: `这是关于「${source.filename}」的文档，包含 ${texts.length} 个片段。`,
    keyPoints: ['核心概念和定义', '主要方法论', '实践案例分析', '建议和最佳实践'],
    topics: ['分析', '方法论', '实践'],
    wordCount,
    generatedAt: new Date().toISOString(),
  };
}

/** GET: read cache only — never call LLM. */
export function getSourceSummary(nid: number, sid: number): SourceSummary {
  const source = requireReadySource(nid, sid);
  const { wordCount } = loadChunkTexts(sid);
  const cached = readCached(source);
  if (cached) return toWire(sid, cached);
  return emptyWire(sid, wordCount);
}

/** POST: generate, persist to metadata.autoSummary, return wire. */
export async function generateAndPersistSourceSummary(
  nid: number,
  sid: number,
): Promise<SourceSummary> {
  const source = requireReadySource(nid, sid);
  const { texts, wordCount } = loadChunkTexts(sid);
  const cache = await generateSummaryPayload(source, texts, wordCount);
  mergeAutoSummary(sid, cache);
  return toWire(sid, cache);
}

/**
 * Fire-and-forget after ready. Failures are logged only — never flip status.
 * Skips when autoSummary already present (unless force).
 */
export function scheduleSourceSummary(sourceId: number, opts?: { force?: boolean }): void {
  void (async () => {
    try {
      const source = db().select().from(sources).where(eq(sources.id, sourceId)).get();
      if (!source || source.status !== 'ready') return;
      if (!opts?.force && readCached(source)) return;
      await generateAndPersistSourceSummary(source.notebookId, sourceId);
    } catch (error) {
      console.error(`[source-summary] async pregenerate failed for source ${sourceId}:`, error);
    }
  })();
}
