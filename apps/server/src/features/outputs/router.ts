import type { Citation } from '@crystalith/shared';
import { NoSuchModelError, TypeValidationError, APICallError, NoObjectGeneratedError } from 'ai';
// Outputs router — /v2/outputs CRUD + generation.
//
//   POST   /v2/outputs           — Generate a new output
//   GET    /v2/outputs            — List outputs for a notebook
//   GET    /v2/outputs/:id        — Get a single output
//   GET    /v2/outputs/types      — List available output types + meta
import { desc, eq, inArray } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { outputs, notebooks, sources, chunks } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { bumpSourcesEpoch } from '../../rag/cache.ts';
import { getDefaultChatModel, getModelById } from '../../shared/config.ts';
import { ErrorCode, sendError } from '../../shared/errors.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';
import { listOutputTypes, type ToolOutputType } from './generator.ts';
import { runOutputPipeline } from './pipeline.ts';
import { renderOutputToMarkdown, splitTextToChunks } from './render.ts';

function requireOutputInNotebook(
  id: number,
  notebookIdRaw: string | undefined,
): typeof outputs.$inferSelect {
  const row = db().select().from(outputs).where(eq(outputs.id, id)).get();
  if (!row) throw new NotFoundError(`Output ${id} not found`);
  if (notebookIdRaw !== undefined && notebookIdRaw !== '') {
    const notebookId = requirePositiveIntId(notebookIdRaw, 'notebook id');
    if (row.notebookId !== notebookId) {
      throw new NotFoundError(`Output ${id} not found`);
    }
  }
  return row;
}

// ---------------------------------------------------------------------------
// OpenAPI docs
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/outputs',
    method: 'post',
    summary: 'Generate a new output',
    tags: ['outputs'],
    responses: { 201: { description: 'Generated output' } },
  },
  {
    path: '/v2/outputs',
    method: 'get',
    summary: 'List outputs for a notebook',
    tags: ['outputs'],
    responses: { 200: { description: 'List of outputs' } },
  },
  {
    path: '/v2/outputs/:id',
    method: 'get',
    summary: 'Get a single output',
    tags: ['outputs'],
    responses: { 200: { description: 'Output details' } },
  },
  {
    path: '/v2/outputs/types',
    method: 'get',
    summary: 'List available output types',
    tags: ['outputs'],
    responses: { 200: { description: 'Output types with metadata' } },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeOutput(row: typeof outputs.$inferSelect) {
  return {
    id: row.id,
    notebookId: row.notebookId,
    type: row.type,
    prompt: row.prompt,
    chunkIds: row.chunkIds,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Walk an output's content tree and collect only the citations actually
 * referenced by leaf nodes (v1 _collect_output_citations, api.py:124-156).
 * pipeline.mapCitationsIntoContent already resolved numeric `citations` arrays
 * into full Citation dicts embedded on leaf nodes, so we recurse and dedup by
 * chunk_id in first-seen order. Returns the cited subset — NOT the full
 * retrieved-chunk superset stored in `outputs.chunkIds`.
 */
export function collectCitedCitations(content: Record<string, unknown> | null): Citation[] {
  if (!content) return [];
  const seen = new Set<number>();
  const out: Citation[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const obj = node as Record<string, unknown>;
    const cited = obj.citations;
    if (Array.isArray(cited)) {
      for (const c of cited) {
        if (!c || typeof c !== 'object') continue;
        const cit = c as Record<string, unknown>;
        const chunkId = cit.chunkId;
        if (typeof chunkId !== 'number' || seen.has(chunkId)) continue;
        seen.add(chunkId);
        out.push(cit as unknown as Citation);
      }
    }
    // Recurse into all object-valued properties.
    for (const v of Object.values(obj)) visit(v);
  };
  visit(content);
  return out;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const outputsRouter = new Elysia({ prefix: '/v2' })
  // List output types
  .get('/outputs/types', () => listOutputTypes())

  // Generate an output
  .post('/outputs', async ({ body, set, request }) => {
    const {
      notebookId: nbIdRaw,
      type,
      chunkIds,
      sourceIds,
      prompt: promptRaw,
      preference,
      topK,
      minScore,
      modelId,
    } = body as Record<string, unknown>;

    // Normalize output type to uppercase (API accepts both 'faq' and 'FAQ')
    const normalizedType = (typeof type === 'string' ? type : '').toUpperCase();

    const notebookId = requirePositiveIntId(nbIdRaw, 'notebook id');

    // Verify notebook
    const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
    if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);

    // c50: reject SLIDES — v1 api.py:205-206 returns 400 "Use slides endpoints
    // for SLIDES output". SLIDES has its own studio pipeline; the generic
    // outputs pipeline has no SLIDES postprocess/isContentEmpty case.
    if (normalizedType === 'SLIDES') {
      return sendError(set, ErrorCode.INVALID_REQUEST, 'Use slides endpoints for SLIDES output');
    }

    // c38 gap fix: sourceIds is required when chunkIds is not provided (v1 api.py:292-293)
    const resolvedSourceIds = sourceIds ? (sourceIds as number[]).map(Number) : undefined;
    const resolvedChunkIds = chunkIds ? (chunkIds as number[]).map(Number) : undefined;
    if (!resolvedChunkIds?.length && !resolvedSourceIds?.length) {
      return sendError(
        set,
        ErrorCode.INVALID_REQUEST,
        'sourceIds must not be empty (or provide chunkIds)',
      );
    }

    // Resolve model (config default or explicit modelId override)
    const modelConfig = modelId
      ? getModelById(
          typeof modelId === 'string' ? modelId : typeof modelId === 'string' ? modelId : '',
        )
      : getDefaultChatModel();
    // c42: granular error mapping (v1 api.py:309-361) — typed exceptions, not string matching
    if (!modelConfig) {
      return sendError(set, ErrorCode.MODEL_UNAVAILABLE, 'No chat model configured');
    }

    let model;
    try {
      model = withRetry(await resolveModel(modelConfig));
    } catch (error) {
      // Model resolution failure → 503 (v1 ModelConfigurationError)
      if (error instanceof NoSuchModelError) {
        return sendError(set, ErrorCode.MODEL_UNAVAILABLE, 'Model not available');
      }
      throw error;
    }

    let result;
    try {
      result = await runOutputPipeline({
        model,
        notebookId,
        type: normalizedType as ToolOutputType,
        chunkIds: resolvedChunkIds,
        sourceIds: resolvedSourceIds,
        prompt: promptRaw ? (typeof promptRaw === 'string' ? promptRaw : '') : undefined,
        preference: preference === 'speed' ? 'speed' : 'quality',
        topK: topK ? Number(topK) : undefined,
        minScore: minScore ? Number(minScore) : undefined,
        modelId: modelId
          ? typeof modelId === 'string'
            ? modelId
            : typeof modelId === 'string'
              ? modelId
              : ''
          : undefined,
        abortSignal: request.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        set.status = 499;
        return { detail: 'Client cancelled' };
      }
      const msg = error instanceof Error ? error.message : String(error);
      // Typed error mapping (v1 api.py:309-361)
      if (error instanceof TypeValidationError || error instanceof NoObjectGeneratedError) {
        return sendError(set, ErrorCode.SCHEMA_VALIDATION_FAILED, msg);
      }
      if (error instanceof NoSuchModelError || error instanceof APICallError) {
        return sendError(set, ErrorCode.MODEL_ERROR, msg);
      }
      if (msg.includes('retrieval')) {
        return sendError(set, ErrorCode.INVALID_REQUEST, msg);
      }
      return sendError(set, ErrorCode.INTERNAL_ERROR, msg);
    }

    // c42: return v1 OutputRead contract (snake_case) instead of PipelineResult
    const row = db().select().from(outputs).where(eq(outputs.id, result.outputId)).get();
    set.status = 201;
    return serializeOutput(row!);
  })

  // List outputs for a notebook
  .get('/outputs', ({ query }) => {
    const notebookId = requirePositiveIntId(
      (query as { notebookId?: string }).notebookId,
      'notebook id',
    );

    const rows = db()
      .select()
      .from(outputs)
      .where(eq(outputs.notebookId, notebookId))
      .orderBy(desc(outputs.createdAt))
      .all();

    return rows.map(serializeOutput);
  })

  // Get a single output (ownership enforced when notebookId provided)
  .get('/outputs/:id', ({ params, query }) => {
    const id = requirePositiveIntId(params.id, 'output id');
    const row = requireOutputInNotebook(id, (query as { notebookId?: string }).notebookId);
    return serializeOutput(row);
  })

  // Delete output
  .delete('/outputs/:id', ({ params, query, set }) => {
    const id = requirePositiveIntId(params.id, 'output id');
    requireOutputInNotebook(id, (query as { notebookId?: string }).notebookId);
    db().delete(outputs).where(eq(outputs.id, id)).run();
    set.status = 204;
    return '';
  })

  // Export output as markdown or json
  .get('/outputs/:id/export', ({ params, query }) => {
    const id = requirePositiveIntId(params.id, 'output id');
    const format = (query.format as 'markdown' | 'json') ?? 'markdown';
    const row = requireOutputInNotebook(id, (query as { notebookId?: string }).notebookId);

    const exportedAt = new Date().toISOString();

    // P1-6: collect only the citations actually referenced in the content tree
    // (v1 _collect_output_citations, api.py:124-156). pipeline.mapCitationsIntoContent
    // already resolved numeric indices into full Citation dicts embedded on
    // leaf nodes, so we walk the tree and dedup by chunk_id (first-seen order).
    // This replaces the prior `row.chunkIds` join which listed ALL retrieved
    // chunks (the superset), not just the cited ones.
    const citations = collectCitedCitations(row.content as Record<string, unknown> | null);
    const sourceIds = [...new Set(citations.map((c) => c.sourceId))];
    const sourceRows = sourceIds.length
      ? db().select().from(sources).where(inArray(sources.id, sourceIds)).all()
      : [];

    if (format === 'json') {
      // c42: full citation fields + correct source metadata (v1 OutputExportJson)
      return {
        notebookId: row.notebookId,
        outputId: row.id,
        outputType: row.type,
        prompt: row.prompt,
        content: row.content,
        citations,
        sources: sourceRows.map((s) => ({
          sourceId: s.id,
          sourceName: s.filename,
          mimeType: s.mimeType,
          parserType: s.parserType,
        })),
        exportedAt,
      };
    }

    // Markdown format — type-aware rendering (v1 _extract_text_from_output)
    // + Citations and Sources sections (v1 api.py:441-476). Citation line
    // format aligns with v1 api.py:452-461:
    //   [N] source_name · chunk N[ · page N][ · para N]
    //   > snippet
    const bodyMarkdown = renderOutputToMarkdown(
      row.type,
      row.content as Record<string, unknown> | null,
      row.prompt,
    );
    const citationLines = citations.map((c, i) => {
      const parts = [`[${i + 1}] ${c.sourceName}`, `chunk ${c.chunkIndex}`];
      if (c.pageNumber !== null && c.pageNumber !== undefined) parts.push(`page ${c.pageNumber}`);
      if (c.paragraphIndex !== null && c.paragraphIndex !== undefined)
        parts.push(`para ${c.paragraphIndex}`);
      const line = parts.join(' · ');
      const snippet = (c.snippet ?? '').trim();
      return snippet ? `${line}\n> ${snippet}` : line;
    });
    const markdown = [
      bodyMarkdown,
      '',
      '## Citations',
      citationLines.length ? citationLines.join('\n\n') : '无引用',
      '',
      '## Sources',
      sourceRows.map((s) => `- ${s.filename} (${s.status})`).join('\n') || '无来源',
    ].join('\n');

    return new Response(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="output-${row.id}-${row.type}.md"`,
      },
    });
  })

  // Convert output to source — type-aware markdown rendering + chunking
  // (v1 api.py:515-739: _extract_text_from_output + _split_text_to_chunks)
  .post('/outputs/:id/convert-to-source', async ({ params, set }) => {
    const id = requirePositiveIntId(params.id, 'output id');
    const row = db().select().from(outputs).where(eq(outputs.id, id)).get();
    if (!row) throw new NotFoundError(`Output ${id} not found`);

    // Render output content to type-aware markdown (not raw JSON)
    const markdown = renderOutputToMarkdown(
      row.type,
      row.content as Record<string, unknown> | null,
      row.prompt,
    );

    // Split into chunks for embedding (v1: 500/50 paragraph+sentence aware)
    const chunkTexts = splitTextToChunks(markdown, 500, 50);
    const filename = `output-${row.id}-${row.type}.md`;

    const sourceRow = db()
      .insert(sources)
      .values({
        notebookId: row.notebookId,
        filename,
        mimeType: 'text/markdown',
        parserType: 'text',
        status: 'processing',
        metadata: { type: row.type, source: 'output_conversion' },
      })
      .returning()
      .get();

    // Create chunks
    let offset = 0;
    for (let i = 0; i < chunkTexts.length; i++) {
      const text = chunkTexts[i];
      db()
        .insert(chunks)
        .values({
          sourceId: sourceRow.id,
          chunkIndex: i,
          text,
          startOffset: offset,
          endOffset: offset + text.length,
        })
        .run();
      // +2 for paragraph separator
      offset += text.length + 2;
    }

    // Embed the chunks so they're discoverable via semantic search.
    try {
      const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
      const strategy = new EmbedStrategy();
      await strategy.indexSource(sourceRow.id, sourceRow.notebookId);
      db().update(sources).set({ status: 'ready' }).where(eq(sources.id, sourceRow.id)).run();
      bumpSourcesEpoch(sourceRow.notebookId);
    } catch {
      db().update(sources).set({ status: 'failed' }).where(eq(sources.id, sourceRow.id)).run();
      bumpSourcesEpoch(sourceRow.notebookId);
    }

    set.status = 201;
    return {
      sourceId: sourceRow.id,
      filename: sourceRow.filename,
      chunkCount: chunkTexts.length,
    };
  });

registerApiDoc(apiDocs);
