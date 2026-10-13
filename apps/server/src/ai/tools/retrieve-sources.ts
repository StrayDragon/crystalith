// retrieveSources tool — embeds the query and runs KNN search against
// sqlite-vec, returning the top-K chunks with citation metadata.
import { tool } from 'ai';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';

import { createDbClient } from '../../db/client.ts';
import type { Orm } from '../../db/index.ts';
import { sources } from '../../db/schema.ts';
import { searchVectors, type VectorHit } from '../../db/vectors.ts';
import { isIndexRebuilding } from '../../rag/index-rebuild.ts';

const RetrieveSourcesArgsSchema = z.object({
  query: z.string().min(1).describe('The search query to retrieve relevant source chunks for.'),
  topK: z.number().int().positive().max(50).default(5).describe('Number of chunks to retrieve.'),
});

interface RetrievedChunk {
  chunkId: number;
  chunkIndex: number;
  sourceId: number;
  sourceName: string;
  text: string;
  score: number;
}

/** Build a retrieveSources tool bound to a specific notebook + ORM + embedder. */
export function retrieveSourcesTool(
  orm: Orm,
  notebookId: number,
  embedder: (text: string) => Promise<Float32Array>,
) {
  return tool({
    description:
      "Retrieve relevant source chunks from the notebook's knowledge base using semantic search. Use this to find evidence before answering questions.",
    inputSchema: RetrieveSourcesArgsSchema,
    execute: async ({ query, topK }): Promise<RetrievedChunk[]> => {
      // c131 r482: while the index is rebuilding/interrupted the tool MUST NOT
      // hand out silently-partial evidence — an empty set lets the research
      // agent see the degrade instead of citing half an index.
      if (await isIndexRebuilding(notebookId)) return [];

      const queryVec = await embedder(query);
      const hits: VectorHit[] = await searchVectors(orm, queryVec, notebookId, topK);

      if (hits.length === 0) return [];

      // Hydrate source names for citation metadata.
      const sourceIds = [...new Set(hits.map((h) => h.source_id))];
      const sourceRows = await createDbClient(orm).all(
        orm
          .select({ id: sources.id, filename: sources.filename })
          .from(sources)
          .where(inArray(sources.id, sourceIds)),
      );
      const sourceMap = new Map(
        sourceRows.map((s: { id: number; filename: string }) => [s.id, s.filename]),
      );

      return hits.map((h) => ({
        chunkId: h.rowid,
        chunkIndex: h.chunk_index,
        sourceId: h.source_id,
        sourceName: sourceMap.get(h.source_id) ?? 'unknown',
        text: h.text,
        // vec_chunks declares cosine; distance ∈ [0,2] — score = 1 - distance (see vectors.ts).
        score: Math.max(0, 1 - h.distance),
      }));
    },
  });
}
