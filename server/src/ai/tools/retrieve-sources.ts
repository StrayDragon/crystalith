// retrieveSources tool — embeds the query and runs KNN search against
// sqlite-vec, returning the top-K chunks with citation metadata.
import { tool } from "ai";
import { z } from "zod";

import type { Orm } from "../../db/index.ts";
import { searchVectors, type VectorHit } from "../../db/vectors.ts";
import { sources } from "../../db/schema.ts";
import { inArray } from "drizzle-orm";

export const RetrieveSourcesArgs = z.object({
  query: z.string().min(1).describe("The search query to retrieve relevant source chunks for."),
  topK: z.number().int().positive().max(50).default(5).describe("Number of chunks to retrieve."),
});

export type RetrieveSourcesArgs = z.infer<typeof RetrieveSourcesArgs>;

export interface RetrievedChunk {
  chunk_id: number;
  chunk_index: number;
  source_id: number;
  source_name: string;
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
    inputSchema: RetrieveSourcesArgs,
    execute: async ({ query, topK }): Promise<RetrievedChunk[]> => {
      const queryVec = await embedder(query);
      const hits: VectorHit[] = searchVectors(orm, queryVec, notebookId, topK);

      if (hits.length === 0) return [];

      // Hydrate source names for citation metadata.
      const sourceIds = [...new Set(hits.map((h) => h.source_id))];
      const sourceRows = orm
        .select({ id: sources.id, filename: sources.filename })
        .from(sources)
        .where(inArray(sources.id, sourceIds))
        .all();
      const sourceMap = new Map(
        sourceRows.map((s: { id: number; filename: string }) => [s.id, s.filename]),
      );

      return hits.map((h) => ({
        chunk_id: h.rowid,
        chunk_index: h.chunk_index,
        source_id: h.source_id,
        source_name: sourceMap.get(h.source_id) ?? "unknown",
        text: h.text,
        // sqlite-vec distance is L2 — convert to a similarity score in [0,1].
        score: Math.max(0, 1 - h.distance),
      }));
    },
  });
}

/** Type guard helper for consuming tool results. */
export function isRetrievedChunk(value: unknown): value is RetrievedChunk {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RetrievedChunk).chunk_id === "number" &&
    typeof (value as RetrievedChunk).text === "string"
  );
}
