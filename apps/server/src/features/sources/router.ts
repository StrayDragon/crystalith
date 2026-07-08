import { SourceSchema } from '@crystalith/shared';
// Sources CRUD + upload router — /v2/sources, /v2/notebooks/:nid/sources
//
// Mirrors v1 `features/sources/api.py` + `features/sources/api_ingest.py`.
import { desc, eq, sql } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { chunks, sources, sourceTags, sourceTagMap } from '../../db/schema.ts';
import { deleteSourceVectors } from '../../db/vectors.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { listParsers } from './parser-registry.ts';
import { ingestSource } from './pipeline.ts';

// ---------------------------------------------------------------------------
// OpenAPI doc registration
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks/:nid/sources',
    method: 'get',
    summary: 'List sources in a notebook',
    tags: ['sources'],
    responses: {
      200: { description: 'List of sources', body: SourceSchema.array() },
    },
  },
  {
    path: '/v2/sources/upload',
    method: 'post',
    summary: 'Upload a file and ingest it',
    tags: ['sources'],
    responses: {
      201: { description: 'Ingestion result' },
    },
  },
  {
    path: '/v2/sources/:id',
    method: 'get',
    summary: 'Get a source by ID with chunks',
    tags: ['sources'],
    responses: { 200: { description: 'Source details', body: SourceSchema } },
  },
  {
    path: '/v2/sources/:id',
    method: 'delete',
    summary: 'Delete a source and its chunks/vectors',
    tags: ['sources'],
    responses: { 204: { description: 'Deleted' } },
  },
  {
    path: '/v2/sources/parsers',
    method: 'get',
    summary: 'List available parsers',
    tags: ['sources'],
    responses: { 200: { description: 'Parser list' } },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeSource(row: {
  id: number;
  notebookId: number;
  filename: string;
  mimeType: string | null;
  parserType: string;
  metadata: unknown;
  dedupKey: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  recoveryHint: string | null;
  lastErrorAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  chunkCount?: number;
  tags?: string[];
}) {
  return {
    id: row.id,
    notebook_id: row.notebookId,
    filename: row.filename,
    mime_type: row.mimeType,
    parser_type: row.parserType,
    metadata: row.metadata as Record<string, unknown> | null | undefined,
    dedup_key: row.dedupKey,
    status: row.status as 'processing' | 'ready' | 'failed',
    error_code: row.errorCode,
    error_message: row.errorMessage,
    recovery_hint: row.recoveryHint,
    last_error_at: row.lastErrorAt?.toISOString() ?? undefined,
    chunk_count: row.chunkCount ?? 0,
    tags: row.tags ?? [],
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function sourceNotFound(id: number): never {
  throw new NotFoundError(`Source ${id} not found`);
}

/** Enrich source rows with chunk counts and tags. */
function enrichSources(
  rows: Array<{
    id: number;
    notebookId: number;
    filename: string;
    mimeType: string | null;
    parserType: string;
    metadata: unknown;
    dedupKey: string | null;
    status: string;
    errorCode: string | null;
    errorMessage: string | null;
    recoveryHint: string | null;
    lastErrorAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>,
) {
  return rows.map((row) => {
    // Get chunk count
    const c = db()
      .select({ c: sql<number>`COUNT(*)` })
      .from(chunks)
      .where(eq(chunks.sourceId, row.id))
      .get();
    const chunkCount = c?.c ?? 0;

    // Get tags
    const tagRows = db()
      .select({ name: sourceTags.name })
      .from(sourceTagMap)
      .innerJoin(sourceTags, eq(sourceTagMap.tagId, sourceTags.id))
      .where(eq(sourceTagMap.sourceId, row.id))
      .all();
    const tags = tagRows.map((t) => t.name);

    return serializeSource({ ...row, chunkCount, tags });
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const sourcesRouter = new Elysia({ prefix: '/v2' })
  // List sources for a notebook
  .get('/notebooks/:nid/sources', ({ params }) => {
    const nid = Number(params.nid);
    const rows = db()
      .select()
      .from(sources)
      .where(eq(sources.notebookId, nid))
      .orderBy(desc(sources.updatedAt))
      .all();
    return enrichSources(rows);
  })

  // Upload + ingest a file
  .post('/sources/upload', async ({ body, query }) => {
    const notebookId = Number(query?.notebook_id);
    if (!notebookId) throw new NotFoundError('notebook_id query param is required');

    // body is FormData; Elysia parses multipart into { filename, file }
    const file = (body as { file?: File }).file;
    if (!file) throw new NotFoundError('No file provided');

    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = await ingestSource({
      buffer,
      filename: file.name,
      notebookId,
      mimeType: file.type,
    });

    return result;
  })

  // Get a source by ID
  .get('/sources/:id', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(sources).where(eq(sources.id, id)).get();
    if (!row) sourceNotFound(id);

    const c = db()
      .select({ c: sql<number>`COUNT(*)` })
      .from(chunks)
      .where(eq(chunks.sourceId, id))
      .get();
    const chunkCount = c?.c ?? 0;

    const tagRows = db()
      .select({ name: sourceTags.name })
      .from(sourceTagMap)
      .innerJoin(sourceTags, eq(sourceTagMap.tagId, sourceTags.id))
      .where(eq(sourceTagMap.sourceId, id))
      .all();
    const tags = tagRows.map((t) => t.name);

    return serializeSource({ ...row, chunkCount, tags });
  })

  // Delete a source
  .delete('/sources/:id', ({ params, set }) => {
    const id = Number(params.id);
    const row = db().select().from(sources).where(eq(sources.id, id)).get();
    if (!row) sourceNotFound(id);

    // Delete vectors first
    deleteSourceVectors(db(), id);

    // Delete source (cascades to chunks via FK)
    db().delete(sources).where(eq(sources.id, id)).run();

    set.status = 204;
    return '';
  })

  // List available parsers
  .get('/sources/parsers', () => {
    return listParsers().map((p) => ({
      id: p.id,
      name: p.name,
      mime_types: p.mimeTypes,
      extensions: p.extensions,
    }));
  });

registerApiDoc(apiDocs);
