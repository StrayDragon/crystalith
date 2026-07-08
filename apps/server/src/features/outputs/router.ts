// Outputs router — /v2/outputs CRUD + generation.
//
//   POST   /v2/outputs           — Generate a new output
//   GET    /v2/outputs            — List outputs for a notebook
//   GET    /v2/outputs/:id        — Get a single output
//   GET    /v2/outputs/types      — List available output types + meta
import { desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { outputs, notebooks, sources, chunks } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { listOutputTypes, type ToolOutputType } from './generator.ts';
import { runOutputPipeline } from './pipeline.ts';

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
  .post('/outputs', async ({ body }) => {
    const { notebook_id, type, chunk_ids, prompt } = body as Record<string, unknown>;
    const notebookId = Number(notebook_id);

    // Verify notebook
    const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
    if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);

    const modelConfig = getDefaultChatModel();
    if (!modelConfig) throw new Error('No chat model configured');
    const model = withRetry(await resolveModel(modelConfig));

    const result = await runOutputPipeline({
      model,
      notebookId,
      type: String(type) as ToolOutputType,
      chunkIds: chunk_ids ? (chunk_ids as number[]).map(Number) : undefined,
      prompt: prompt ? String(prompt) : undefined,
    });

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

  // Get a single output
  .get('/outputs/:id', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(outputs).where(eq(outputs.id, id)).get();
    if (!row) throw new NotFoundError(`Output ${id} not found`);
    return serializeOutput(row);
  })

  // Delete output
  .delete('/outputs/:id', ({ params, set }) => {
    const id = Number(params.id);
    const row = db().select().from(outputs).where(eq(outputs.id, id)).get();
    if (!row) throw new NotFoundError(`Output ${id} not found`);
    db().delete(outputs).where(eq(outputs.id, id)).run();
    set.status = 204;
    return '';
  })

  // Export output as JSON
  .get('/outputs/:id/export', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(outputs).where(eq(outputs.id, id)).get();
    if (!row) throw new NotFoundError(`Output ${id} not found`);
    return {
      id: row.id,
      notebook_id: row.notebookId,
      type: row.type,
      content: row.content,
      prompt: row.prompt,
      chunk_ids: row.chunkIds,
      created_at: row.createdAt.toISOString(),
    };
  })

  // Convert output to source
  .post('/outputs/:id/convert-to-source', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(outputs).where(eq(outputs.id, id)).get();
    if (!row) throw new NotFoundError(`Output ${id} not found`);

    // Create a plain-text source from the output content
    const contentStr = JSON.stringify(row.content ?? {});
    const sourceRow = db()
      .insert(sources)
      .values({
        notebookId: row.notebookId,
        filename: `output-${id}-${row.type}.json`,
        mimeType: 'application/json',
        parserType: 'text',
        status: 'ready',
        metadata: { type: row.type, source: 'output_conversion' },
      })
      .returning()
      .get();

    // Create a single chunk from the output
    db()
      .insert(chunks)
      .values({
        sourceId: sourceRow.id,
        chunkIndex: 0,
        text: contentStr,
        startOffset: 0,
        endOffset: contentStr.length,
      })
      .run();

    return {
      source_id: sourceRow.id,
      filename: sourceRow.filename,
      chunk_count: 1,
    };
  });

registerApiDoc(apiDocs);
