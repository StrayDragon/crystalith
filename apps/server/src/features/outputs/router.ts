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
import { getDefaultChatModel, getModelById } from '../../shared/config.ts';
import { listOutputTypes, type ToolOutputType } from './generator.ts';
import { runOutputPipeline } from './pipeline.ts';
import { renderOutputToMarkdown, splitTextToChunks } from './render.ts';

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
    notebook_id: row.notebookId,
    type: row.type,
    prompt: row.prompt,
    chunk_ids: row.chunkIds,
    content: row.content,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const outputsRouter = new Elysia({ prefix: '/v2' })
  // List output types
  .get('/outputs/types', () => listOutputTypes())

  // Generate an output
  .post('/outputs', async ({ body, set }) => {
    const {
      notebook_id,
      type,
      chunk_ids,
      source_ids,
      prompt,
      preference,
      top_k,
      min_score,
      model_id,
    } = body as Record<string, unknown>;
    const notebookId = Number(notebook_id);

    // Verify notebook
    const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
    if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);

    // c38 gap fix: source_ids is required when chunk_ids is not provided (v1 api.py:292-293)
    const resolvedSourceIds = source_ids ? (source_ids as number[]).map(Number) : undefined;
    const resolvedChunkIds = chunk_ids ? (chunk_ids as number[]).map(Number) : undefined;
    if (!resolvedChunkIds?.length && !resolvedSourceIds?.length) {
      set.status = 400;
      return { error: 'source_ids must not be empty (or provide chunk_ids)' };
    }

    // Resolve model (config default or explicit model_id override)
    const modelConfig = model_id ? getModelById(String(model_id)) : getDefaultChatModel();
    if (!modelConfig) throw new Error('No chat model configured');
    const model = withRetry(await resolveModel(modelConfig));

    const result = await runOutputPipeline({
      model,
      notebookId,
      type: String(type) as ToolOutputType,
      chunkIds: resolvedChunkIds,
      sourceIds: resolvedSourceIds,
      prompt: prompt ? String(prompt) : undefined,
      preference: preference === 'speed' ? 'speed' : 'quality',
      topK: top_k ? Number(top_k) : undefined,
      minScore: min_score ? Number(min_score) : undefined,
      modelId: model_id ? String(model_id) : undefined,
    });

    set.status = 201;
    return result;
  })

  // List outputs for a notebook
  .get('/outputs', ({ query }) => {
    const notebookId = Number((query as { notebook_id?: string }).notebook_id);
    if (!notebookId) throw new NotFoundError('notebook_id query param required');

    const rows = db()
      .select()
      .from(outputs)
      .where(eq(outputs.notebookId, notebookId))
      .orderBy(desc(outputs.createdAt))
      .all();

    return rows.map(serializeOutput);
  })

  // Get a single output (c38 gap fix: notebook ownership check)
  .get('/outputs/:id', ({ params, query }) => {
    const id = Number(params.id);
    const row = db().select().from(outputs).where(eq(outputs.id, id)).get();
    if (!row) throw new NotFoundError(`Output ${id} not found`);
    const nid = (query as { notebook_id?: string }).notebook_id;
    if (nid && row.notebookId !== Number(nid)) throw new NotFoundError(`Output ${id} not found`);
    return serializeOutput(row);
  })

  // Delete output (c38 gap fix: notebook ownership check)
  .delete('/outputs/:id', ({ params, query, set }) => {
    const id = Number(params.id);
    const row = db().select().from(outputs).where(eq(outputs.id, id)).get();
    if (!row) throw new NotFoundError(`Output ${id} not found`);
    const nid = (query as { notebook_id?: string }).notebook_id;
    if (nid && row.notebookId !== Number(nid)) throw new NotFoundError(`Output ${id} not found`);
    db().delete(outputs).where(eq(outputs.id, id)).run();
    set.status = 204;
    return '';
  })

  // Export output as markdown or json (c38 gap fix: default markdown + Citations/Sources sections)
  .get('/outputs/:id/export', ({ params, query }) => {
    const id = Number(params.id);
    // c38 gap fix: default format is markdown (v1 api.py:411)
    const format = (query.format as 'markdown' | 'json') ?? 'markdown';
    const row = db().select().from(outputs).where(eq(outputs.id, id)).get();
    if (!row) throw new NotFoundError(`Output ${id} not found`);
    const nid = (query as { notebook_id?: string }).notebook_id;
    if (nid && row.notebookId !== Number(nid)) throw new NotFoundError(`Output ${id} not found`);

    const exportedAt = new Date().toISOString();

    if (format === 'json') {
      // Hydrate citations + sources metadata
      const chunkIds = (row.chunkIds as number[] | null) ?? [];
      const citationRows = chunkIds.length
        ? db()
            .select({
              chunkId: chunks.id,
              text: chunks.text,
              sourceId: chunks.sourceId,
              sourceName: sources.filename,
            })
            .from(chunks)
            .innerJoin(sources, eq(chunks.sourceId, sources.id))
            .where(inArray(chunks.id, chunkIds))
            .all()
        : [];
      const citations = citationRows.map((c) => ({
        source_id: c.sourceId,
        source_name: c.sourceName,
        chunk_id: c.chunkId,
        snippet: c.text.slice(0, 200),
      }));
      const sourceIds = [...new Set(citations.map((c) => c.source_id))];
      const sourceRows = sourceIds.length
        ? db().select().from(sources).where(inArray(sources.id, sourceIds)).all()
        : [];
      return {
        id: row.id,
        notebook_id: row.notebookId,
        type: row.type,
        content: row.content,
        prompt: row.prompt,
        chunk_ids: row.chunkIds,
        citations,
        sources: sourceRows.map((s) => ({ id: s.id, filename: s.filename, status: s.status })),
        exported_at: exportedAt,
      };
    }

    // Markdown format — type-aware rendering (v1 _extract_text_from_output)
    // + Citations and Sources sections (v1 api.py:441-476)
    const bodyMarkdown = renderOutputToMarkdown(
      row.type,
      row.content as Record<string, unknown> | null,
      row.prompt,
    );
    // Build citations + sources sections
    const chunkIds = (row.chunkIds as number[] | null) ?? [];
    const citationRows = chunkIds.length
      ? db()
          .select({
            chunkId: chunks.id,
            text: chunks.text,
            sourceId: chunks.sourceId,
            sourceName: sources.filename,
          })
          .from(chunks)
          .innerJoin(sources, eq(chunks.sourceId, sources.id))
          .where(inArray(chunks.id, chunkIds))
          .all()
      : [];
    const citationLines = citationRows.map((c, i) => {
      const snippet = c.text.slice(0, 200).trim();
      return snippet ? `[${i + 1}] ${c.sourceName}\n> ${snippet}` : `[${i + 1}] ${c.sourceName}`;
    });
    const sourceIds = [...new Set(citationRows.map((c) => c.sourceId))];
    const sourceRows = sourceIds.length
      ? db().select().from(sources).where(inArray(sources.id, sourceIds)).all()
      : [];
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
    const id = Number(params.id);
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
      offset += text.length + 2; // +2 for paragraph separator
    }

    // Embed the chunks so they're discoverable via semantic search.
    try {
      const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
      const strategy = new EmbedStrategy();
      await strategy.indexSource(sourceRow.id, sourceRow.notebookId);
      db().update(sources).set({ status: 'ready' }).where(eq(sources.id, sourceRow.id)).run();
    } catch {
      db().update(sources).set({ status: 'failed' }).where(eq(sources.id, sourceRow.id)).run();
    }

    set.status = 201;
    return {
      source_id: sourceRow.id,
      filename: sourceRow.filename,
      chunk_count: chunkTexts.length,
    };
  });

registerApiDoc(apiDocs);
