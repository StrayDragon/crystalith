// Source extras router — /v2/notebooks/:nid/sources/:sid/{summary,qa,qa-to-source}
//
// Mirrors v1 `features/sources/api_summary.py` + `features/sources/api_qa.py`.
// Split from the main sources router to avoid Elysia chaining complexity.
import { generateText } from 'ai';
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { chunks, sources } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { ErrorCode, sendError } from '../../shared/errors.ts';

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks/:nid/sources/:sid/summary',
    method: 'get',
    summary: 'Generate AI summary for a source',
    tags: ['sources'],
    responses: { 200: { description: 'Source summary' } },
  },
  {
    path: '/v2/notebooks/:nid/sources/:sid/qa',
    method: 'post',
    summary: 'Ask a question about a single source',
    tags: ['sources'],
    responses: { 200: { description: 'QA answer' } },
  },
  {
    path: '/v2/notebooks/:nid/sources/:sid/qa-to-source',
    method: 'post',
    summary: 'Convert per-source QA into a new source',
    tags: ['sources'],
    responses: { 201: { description: 'New source from QA' } },
  },
];

// ---------------------------------------------------------------------------
// parseSummaryResponse — mirrors v1 api_summary.py:36
// ---------------------------------------------------------------------------

function parseSummaryResponse(response: string): {
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

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const sourceExtrasRouter = new Elysia({ prefix: '/v2' })
  // Source summary (v1 api_summary.py parity)
  .get('/notebooks/:nid/sources/:sid/summary', async ({ params, set }) => {
    const nid = Number(params.nid);
    const sid = Number(params.sid);
    const source = db().select().from(sources).where(eq(sources.id, sid)).get();
    if (!source) throw new NotFoundError(`Source ${sid} not found`);
    // c44: verify notebook ownership (v1 api_summary.py:82)
    if (source.notebookId !== nid) throw new NotFoundError(`Source ${sid} not found`);
    // c44: "not ready" → 400 (v1 api_summary.py:86)
    if (source.status !== 'ready') {
      return sendError(set, ErrorCode.INVALID_REQUEST, 'Source is not ready');
    }

    const chunkRows = db()
      .select()
      .from(chunks)
      .where(eq(chunks.sourceId, sid))
      .orderBy(chunks.chunkIndex)
      .all();

    if (chunkRows.length === 0) throw new NotFoundError('Source has no content');

    const totalText = chunkRows.map((c) => c.text).join(' ');
    const wordCount = totalText.split(/\s+/u).length;

    const contextBlocks = chunkRows.slice(0, 10);
    const context = contextBlocks.map((c, i) => `[片段 ${i + 1}]\n${c.text}`).join('\n\n');

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
        const { summary, keyPoints, topics } = parseSummaryResponse(text);
        return {
          source_id: sid,
          summary,
          key_points: keyPoints,
          topics,
          word_count: wordCount,
        };
      } catch {
        // fall through
      }
    }

    return {
      source_id: sid,
      summary: `这是关于「${source.filename}」的文档，包含 ${chunkRows.length} 个片段。`,
      key_points: ['核心概念和定义', '主要方法论', '实践案例分析', '建议和最佳实践'],
      topics: ['分析', '方法论', '实践'],
      word_count: wordCount,
    };
  })

  // Per-source QA (c39: vector retrieval instead of first-N chunks — v1 api_qa.py:82-119)
  .post('/notebooks/:nid/sources/:sid/qa', async ({ params, body, set }) => {
    const nid = Number(params.nid);
    const sid = Number(params.sid);
    const source = db().select().from(sources).where(eq(sources.id, sid)).get();
    if (!source) throw new NotFoundError(`Source ${sid} not found`);
    // c44: verify notebook ownership (v1 api_qa.py:64)
    if (source.notebookId !== nid) throw new NotFoundError(`Source ${sid} not found`);
    // c44: "not ready" → 400 (v1 api_qa.py:67)
    if (source.status !== 'ready') {
      return sendError(set, ErrorCode.INVALID_REQUEST, 'Source is not ready');
    }

    const { question } = body as { question: string };
    if (!question?.trim()) throw new NotFoundError('Question is required');

    const modelConfig = getDefaultChatModel();
    if (!modelConfig) throw new Error('No chat model configured');

    // c39: Use vector retrieval scoped to this source (v1 cached_vector_search)
    let contextChunks: Array<{ text: string; score: number }> = [];
    try {
      const { ragRegistry } = await import('../../rag/registry.ts');
      const results = await ragRegistry.retrieveWith('embed', source.notebookId, question.trim(), {
        topK: 5,
        minScore: 0.1,
        sourceIds: [sid],
      });
      contextChunks = results.map((r) => ({ text: r.text, score: r.score }));
    } catch {
      // Fallback: vector search unavailable — use first N chunks
    }

    // Fallback: if vector search returned nothing, take first chunks
    if (contextChunks.length === 0) {
      const chunkRows = db()
        .select({ text: chunks.text })
        .from(chunks)
        .where(eq(chunks.sourceId, sid))
        .orderBy(chunks.chunkIndex)
        .all();
      contextChunks = chunkRows.slice(0, 15).map((c) => ({ text: c.text, score: 0 }));
    }

    if (contextChunks.length === 0) throw new NotFoundError('Source has no content');

    const context = contextChunks.map((c) => c.text).join('\n\n');

    const model = withRetry(await resolveModel(modelConfig));
    const { text } = await generateText({
      model,
      abortSignal: AbortSignal.timeout(30_000),
      system:
        'You are a QA assistant. Answer questions based strictly on the provided document. If the document does not contain relevant information, say so honestly.',
      prompt: `Document: ${source.filename}\n\nContent:\n${context}\n\nQuestion: ${question.trim()}`,
    });

    return {
      source_id: sid,
      source_name: source.filename,
      question: question.trim(),
      answer: text,
    };
  })

  // Convert per-source QA to a source (v1 api_qa.py:204 parity)
  .post('/notebooks/:nid/sources/:sid/qa-to-source', async ({ params, body }) => {
    const nid = Number(params.nid);
    const sid = Number(params.sid);
    const source = db().select().from(sources).where(eq(sources.id, sid)).get();
    if (!source) throw new NotFoundError(`Source ${sid} not found`);
    // c44: verify notebook ownership (v1 api_qa.py:221)
    if (source.notebookId !== nid) throw new NotFoundError(`Source ${sid} not found`);

    // c53: accept multi-turn messages list (v1 api_qa.py:186-209,204-209) OR
    // the single-turn {question, answer} shortcut. Multi-turn formats a full
    // transcript; single-turn wraps the one Q/A pair.
    const { question, answer, messages } = body as {
      question?: string;
      answer?: string;
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, '-');
    const filename = `QA_${source.filename}_${timestamp}.md`;

    let text: string;
    if (messages && messages.length > 0) {
      // Multi-turn transcript (v1 api_qa.py:186-201 format)
      const turns = messages
        .map((m) => {
          const label = m.role === 'assistant' ? '助手' : '用户';
          return `**${label}**: ${m.content}`;
        })
        .join('\n\n');
      text = `# Q&A\n\n${turns}\n\n*Based on source: ${source.filename}*`;
    } else {
      if (!question?.trim() || !answer?.trim()) {
        throw new NotFoundError('question and answer are required (or provide messages)');
      }
      text = `# Q&A: ${question.trim()}\n\n**Question**: ${question.trim()}\n\n**Answer**: ${answer.trim()}\n\n*Based on source: ${source.filename}*`;
    }

    const newSource = db()
      .insert(sources)
      .values({
        notebookId: source.notebookId,
        filename,
        status: 'processing',
        metadata: { qa_from_source: sid, original_filename: source.filename },
      })
      .returning()
      .get();

    const { chunkText } = await import('../../rag/chunker.ts');
    const reportChunks = chunkText(text);

    const chunkRows: Array<{ id: number; text: string }> = [];
    for (const chunk of reportChunks) {
      const chunkRow = db()
        .insert(chunks)
        .values({
          sourceId: newSource.id,
          chunkIndex: chunk.index,
          text: chunk.text,
          metadata: { source_type: 'qa_conversion' },
        })
        .returning()
        .get();
      chunkRows.push({ id: chunkRow.id, text: chunk.text });
    }

    if (chunkRows.length > 0) {
      try {
        const { embedBatch } = await import('../../rag/embedder.ts');
        const { insertChunkVector } = await import('../../db/vectors.ts');
        const vectors = await embedBatch(chunkRows.map((c) => c.text));
        for (const [i, vec] of vectors.entries()) {
          insertChunkVector(db(), chunkRows[i].id, source.notebookId, newSource.id, vec);
        }
        const { bumpVectorEpoch, bumpSourcesEpoch } = await import('../../rag/cache.ts');
        bumpVectorEpoch(source.notebookId);
        bumpSourcesEpoch(source.notebookId);
        // Only set ready after successful embedding (c39: fix ready-before-vectors race)
        db().update(sources).set({ status: 'ready' }).where(eq(sources.id, newSource.id)).run();
      } catch (error) {
        console.error('[source-extras] qa-to-source embedding failed:', error);
        db()
          .update(sources)
          .set({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Embedding failed',
          })
          .where(eq(sources.id, newSource.id))
          .run();
        throw new Error('Failed to embed QA source', { cause: error });
      }
    } else {
      // No chunks — safe to mark ready
      db().update(sources).set({ status: 'ready' }).where(eq(sources.id, newSource.id)).run();
    }

    return {
      source_id: newSource.id,
      filename,
      chunk_count: chunkRows.length,
    };
  });

registerApiDoc(apiDocs);
