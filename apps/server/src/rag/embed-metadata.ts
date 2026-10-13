// r483 (c131): every path that inserts chunk vectors MUST stamp embedding
// metadata (embedding_model / embedding_dims) on those chunk rows. Shared by
// indexSource, sessions convert and qa-to-source so the three write paths
// cannot drift apart.
import { eq } from 'drizzle-orm';

import { client, db } from '../db/index.ts';
import { chunks } from '../db/schema.ts';
import { getDefaultEmbeddingModel } from '../shared/config.ts';

/**
 * Stamp embedding index metadata on a source's chunk rows.
 * A re-embed overwrites both columns, so no stale values survive.
 */
export async function markChunksEmbedded(
  sourceId: number,
  vectorDims: number | null,
): Promise<void> {
  await client().run(
    db()
      .update(chunks)
      .set({
        embeddingModel: getDefaultEmbeddingModel()?.id ?? null,
        embeddingDims: vectorDims,
      })
      .where(eq(chunks.sourceId, sourceId)),
  );
}

/**
 * Direct-write convenience: derive dims from the embedded vectors and stamp.
 * (Call after insertChunkVector — same contract as markChunksEmbedded.)
 */
export async function markChunksEmbeddedFromVectors(
  sourceId: number,
  vectors: readonly Float32Array[],
): Promise<void> {
  await markChunksEmbedded(sourceId, vectors[0]?.length ?? null);
}
