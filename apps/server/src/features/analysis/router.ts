import { generateObject } from 'ai';
// Analysis router — POST /v2/analysis
//
// Runs LLM-powered analysis of a notebook: topic clustering, contradiction
// detection, and relation/correlation mapping. Uses generateObject with
// structured schema output.
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { chunks, sources, notebooks } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { getDefaultChatModel } from '../../shared/config.ts';

// ---------------------------------------------------------------------------
// Analysis output schema (for generateObject)
// ---------------------------------------------------------------------------

const AnalysisOutputSchema = z.object({
  topics: z
    .array(
      z.object({
        name: z.string(),
        keywords: z.array(z.string()),
        summary: z.string(),
      }),
    )
    .describe('Main topics identified in the notebook'),
  contradictions: z
    .array(
      z.object({
        topic: z.string(),
        statement_a: z.string(),
        statement_b: z.string(),
        resolution: z.string().optional(),
      }),
    )
    .describe('Contradictions or inconsistencies found across sources'),
  relations: z
    .array(
      z.object({
        topic_a: z.string(),
        topic_b: z.string(),
        relation: z
          .string()
          .describe('How topics relate: similar, references, contradicts, complements'),
      }),
    )
    .describe('Relationships between identified topics'),
  summary: z.string().describe('Overall analysis summary'),
});

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/analysis',
    method: 'post',
    summary: 'Analyze a notebook (topics, contradictions, relations)',
    tags: ['analysis'],
    responses: { 200: { description: 'Analysis result' } },
  },
];

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const analysisRouter = new Elysia({ prefix: '/v2' }).post('/analysis', async ({ body }) => {
  const { notebook_id } = body as { notebook_id: number };
  const notebookId = Number(notebook_id);

  const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
  if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);

  // Gather all chunks for this notebook
  const chunkRows = db()
    .select({
      text: chunks.text,
      chunkIndex: chunks.chunkIndex,
      filename: sources.filename,
    })
    .from(chunks)
    .innerJoin(sources, eq(chunks.sourceId, sources.id))
    .where(eq(sources.notebookId, notebookId))
    .all();

  if (chunkRows.length === 0) {
    return { topics: [], contradictions: [], relations: [], summary: 'No content to analyze.' };
  }

  const context = chunkRows
    .map((c) => `[${c.filename}:${c.chunkIndex}] ${c.text}`)
    .join('\n\n')
    .substring(0, 8000);

  const modelConfig = getDefaultChatModel();
  if (!modelConfig) throw new Error('No chat model configured');
  const model = withRetry(await resolveModel(modelConfig));

  const { object } = await generateObject({
    model,
    schema: AnalysisOutputSchema,
    system: `You are a knowledge analysis expert. Analyze the provided notebook content and identify:
1. Main topics with keywords
2. Contradictions or inconsistencies between sources
3. Relationships between topics (similar, references, contradicts, complements)
Be thorough and precise.`,
    prompt: `Analyze this notebook content:\n\n${context}`,
  });

  return object;
});

registerApiDoc(apiDocs);
