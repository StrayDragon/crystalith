// Source extras router — /v2/notebooks/:nid/sources/:sid/{summary,qa,qa-to-source}
//
// Mirrors v1 `features/sources/api_summary.py` + `features/sources/api_qa.py`.
// Split from the main sources router to avoid Elysia chaining complexity.
import {
  ConvertSourceQAToSourceRequestSchema,
  ConvertSourceQAToSourceResponseSchema,
  SourceQARequestSchema,
  SourceQAResponseSchema,
  SourceSummarySchema,
} from '@crystalith/shared';
import { generateText } from 'ai';
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { chunks, sources } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { PathId } from '../../shared/ids.ts';
import { requireOwnedRow } from '../../shared/notebook-scope.ts';
import {
  generateAndPersistSourceSummary,
  getSourceSummary,
  scheduleSourceSummary,
} from './source-summary.ts';

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks/:nid/sources/:sid/summary',
    method: 'get',
    summary: '读取来源 AI 摘要缓存（只读）',
    tags: ['sources'],
    responses: { 200: { description: '摘要或空状态' } },
  },
  {
    path: '/v2/notebooks/:nid/sources/:sid/summary',
    method: 'post',
    summary: '生成并写入来源 AI 摘要',
    tags: ['sources'],
    responses: { 200: { description: '摘要' } },
  },
  {
    path: '/v2/notebooks/:nid/sources/:sid/qa',
    method: 'post',
    summary: '单来源问答',
    tags: ['sources'],
    responses: { 200: { description: '问答结果' } },
  },
  {
    path: '/v2/notebooks/:nid/sources/:sid/qa-to-source',
    method: 'post',
    summary: '将来源问答结果写入为新来源',
    tags: ['sources'],
    responses: {
      201: { description: '由问答生成的来源', body: ConvertSourceQAToSourceResponseSchema },
    },
  },
];

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const sourceExtrasRouter = new Elysia({ prefix: '/v2' })
  // Source summary — GET is cache-only (c74); POST generates & persists
  .get(
    '/notebooks/:nid/sources/:sid/summary',
    ({ params }) => {
      const nid = params.nid;
      const sid = params.sid;
      return getSourceSummary(nid, sid);
    },
    { params: z.object({ nid: PathId, sid: PathId }), response: SourceSummarySchema },
  )
  .post(
    '/notebooks/:nid/sources/:sid/summary',
    async ({ params }) => {
      const nid = params.nid;
      const sid = params.sid;
      return generateAndPersistSourceSummary(nid, sid);
    },
    { params: z.object({ nid: PathId, sid: PathId }), response: SourceSummarySchema },
  )

  // Per-source QA (c39: vector retrieval instead of first-N chunks — v1 api_qa.py:82-119)
  .post(
    '/notebooks/:nid/sources/:sid/qa',
    async ({ params, body }) => {
      const nid = params.nid;
      const sid = params.sid;
      const source = requireOwnedRow(sources, sid, nid, 'Source');
      // c44: "not ready" → 400 (v1 api_qa.py:67)
      if (source.status !== 'ready') {
        throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'Source is not ready');
      }

      const question = body.question.trim();
      if (!question) throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'Question is required');

      const modelConfig = getDefaultChatModel();
      if (!modelConfig)
        throw new AppHttpError(ErrorCode.MODEL_UNAVAILABLE, 'No chat model configured');

      // c39: Use vector retrieval scoped to this source (v1 cached_vector_search)
      let contextChunks: Array<{ text: string; score: number }> = [];
      try {
        const { ragRegistry } = await import('../../rag/registry.ts');
        const results = await ragRegistry.retrieveWith('embed', source.notebookId, question, {
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
        instructions:
          'You are a QA assistant. Answer questions based strictly on the provided document. If the document does not contain relevant information, say so honestly.',
        prompt: `Document: ${source.filename}\n\nContent:\n${context}\n\nQuestion: ${question}`,
      });

      return {
        sourceId: sid,
        sourceName: source.filename,
        question,
        answer: text,
      };
    },
    {
      params: z.object({ nid: PathId, sid: PathId }),
      body: SourceQARequestSchema,
      response: SourceQAResponseSchema,
    },
  )

  // Convert per-source QA to a source (v1 api_qa.py:204 parity)
  .post(
    '/notebooks/:nid/sources/:sid/qa-to-source',
    async ({ params, body, set }) => {
      const nid = params.nid;
      const sid = params.sid;
      const source = requireOwnedRow(sources, sid, nid, 'Source');

      // Multi-turn messages list (v1) OR single-turn {question, answer} shortcut.
      const { question, answer, messages } = body;

      const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, '-');
      const filename = `QA_${source.filename}_${timestamp}.md`;

      let text: string;
      if (messages && messages.length > 0) {
        const turns = messages
          .map((m) => {
            const label = m.role === 'assistant' ? '助手' : '用户';
            return `**${label}**: ${m.content}`;
          })
          .join('\n\n');
        text = `# Q&A\n\n${turns}\n\n*Based on source: ${source.filename}*`;
      } else {
        text = `# Q&A: ${question!.trim()}\n\n**Question**: ${question!.trim()}\n\n**Answer**: ${answer!.trim()}\n\n*Based on source: ${source.filename}*`;
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
          scheduleSourceSummary(newSource.id);
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
          throw new AppHttpError(ErrorCode.INTERNAL_ERROR, 'Failed to embed QA source', {
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        // No chunks — safe to mark ready (no summary without content)
        db().update(sources).set({ status: 'ready' }).where(eq(sources.id, newSource.id)).run();
      }

      set.status = 201;
      return {
        sourceId: newSource.id,
        filename,
        chunkCount: chunkRows.length,
      };
    },
    {
      params: z.object({ nid: PathId, sid: PathId }),
      body: ConvertSourceQAToSourceRequestSchema,
      response: ConvertSourceQAToSourceResponseSchema,
    },
  );

registerApiDoc(apiDocs);
