// Analysis router — POST /v2/analysis
//
// Runs multi-phase analysis:
//  1. Topic clustering (embedding-vector greedy centroid, c28)
//  2. Relation detection (embedding-vector cosine similarity, c28)
//  3. Contradiction detection (LLM pairwise on top similar pairs)
//  4. LLM summary via generateObject
import { generateObject } from 'ai';
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { chunks, notebooks, sources } from '../../db/schema.ts';
import { getStoredVectors } from '../../db/vectors.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { clusterTopics } from './clustering.ts';
import { detectContradictions } from './contradiction.ts';
import { detectRelations } from './correlation.ts';

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
// Analysis output schema (overall summary by LLM)
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
      id: chunks.id,
      text: chunks.text,
      chunkIndex: chunks.chunkIndex,
      sourceId: chunks.sourceId,
      filename: sources.filename,
    })
    .from(chunks)
    .innerJoin(sources, eq(chunks.sourceId, sources.id))
    .where(eq(sources.notebookId, notebookId))
    .all();

  if (chunkRows.length === 0) {
    return { topics: [], contradictions: [], relations: [], summary: 'No content to analyze.' };
  }

  // Fetch stored embedding vectors for this notebook (c28 — real vectors).
  const storedVectors = getStoredVectors(db(), notebookId);
  const vectorByChunk = new Map(storedVectors.map((v) => [v.chunkId, v.vector]));

  // Build entry maps for the analysis modules
  const chunkTextMap = new Map<number, string>();
  for (const c of chunkRows) {
    chunkTextMap.set(c.id, c.text);
  }

  // Only include chunks that have embedding vectors indexed.
  const vectorEntries = chunkRows
    .filter((c) => vectorByChunk.has(c.id))
    .map((c) => ({
      chunkId: c.id,
      sourceId: c.sourceId,
      vector: vectorByChunk.get(c.id)!,
      text: c.text,
    }));

  if (vectorEntries.length === 0) {
    return {
      topics: [],
      contradictions: [],
      relations: [],
      summary: 'No indexed content to analyze.',
    };
  }

  // Phase 1: Topic clustering (embedding vectors)
  const topics = clusterTopics(vectorEntries);

  // Phase 2: Relation detection (embedding cosine similarity)
  const relations = detectRelations(vectorEntries, notebookId);

  // Phase 3: Contradiction detection (LLM pairwise on top similar pairs)
  const contradictions = await detectContradictions(relations, chunkTextMap);

  // Phase 4: LLM summary via generateObject using topic/relation/contradiction context
  const context = buildAnalysisContext(topics, relations, contradictions, chunkRows);

  const modelConfig = getDefaultChatModel();
  if (!modelConfig) throw new Error('No chat model configured');
  const model = withRetry(await resolveModel(modelConfig));

  const { object } = await generateObject({
    model,
    schema: AnalysisOutputSchema,
    system: `You are a knowledge analysis expert. Based on the pre-computed topics, relations, and contradictions, produce a structured analysis.`,
    prompt: context,
  });

  return object;
});

registerApiDoc(apiDocs);

// ---------------------------------------------------------------------------
// Build a structured context from the analysis phases
// ---------------------------------------------------------------------------

function buildAnalysisContext(
  topics: Array<{ id: string; name: string; keywords: string[]; chunkIds: number[] }>,
  relations: Array<{
    sourceChunkId: number;
    targetChunkId: number;
    relationType: string;
    score: number;
  }>,
  contradictions: Array<{
    sourceChunkId: number;
    targetChunkId: number;
    relationType: string;
    score: number;
  }>,
  chunkRows: Array<{ id: number; text: string; filename: string; chunkIndex: number }>,
): string {
  const chunkById = new Map(chunkRows.map((c) => [c.id, c]));

  let output = '## Topics\n';
  for (const topic of topics) {
    output += `- ${topic.name} (keywords: ${topic.keywords.join(', ')})\n`;
  }

  if (relations.length > 0) {
    output += '\n## Relations\n';
    for (const rel of relations.slice(0, 30)) {
      const left = chunkById.get(rel.sourceChunkId);
      const right = chunkById.get(rel.targetChunkId);
      output += `- [${rel.relationType}] ${left?.filename ?? '?'}:${rel.sourceChunkId} ↔ ${right?.filename ?? '?'}:${rel.targetChunkId} (score: ${rel.score.toFixed(2)})\n`;
    }
  }

  if (contradictions.length > 0) {
    output += '\n## Contradictions\n';
    for (const con of contradictions.slice(0, 10)) {
      const left = chunkById.get(con.sourceChunkId);
      const right = chunkById.get(con.targetChunkId);
      output += `- ${left?.filename ?? '?'} vs ${right?.filename ?? '?'}\n`;
      output += `  A: ${truncate(chunkById.get(con.sourceChunkId)?.text ?? '', 200)}\n`;
      output += `  B: ${truncate(chunkById.get(con.targetChunkId)?.text ?? '', 200)}\n`;
    }
  }

  return output;
}

function truncate(text: string, limit: number): string {
  const cleaned = text.replaceAll(/\s+/g, ' ').trim();
  return cleaned.length <= limit ? cleaned : cleaned.slice(0, limit) + '...';
}
