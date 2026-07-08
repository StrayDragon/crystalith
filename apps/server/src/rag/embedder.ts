// Embedder — calls AI SDK embedding provider to generate vector embeddings.
//
// Uses the default embedding model from config (e.g. bge-m3 1024-dim).
// Falls back gracefully when no embedding model is configured.
import type { EmbeddingModelV4 } from '@ai-sdk/provider';
import { embed, embedMany } from 'ai';

import { resolveEmbeddingModel } from '../ai/providers.ts';
import { getDefaultEmbeddingModel } from '../shared/config.ts';

let _embedModel: EmbeddingModelV4 | null = null;

/**
 * Get or lazily initialize the embedding model singleton.
 * Returns null if no embedding model is configured.
 */
export async function getEmbedModel(): Promise<EmbeddingModelV4 | null> {
  if (_embedModel) return _embedModel;

  const config = getDefaultEmbeddingModel();
  if (!config) return null;

  _embedModel = await resolveEmbeddingModel(config);
  return _embedModel;
}

/**
 * Embed a single text string. Returns Float32Array of the embedding.
 */
export async function embedSingle(text: string): Promise<Float32Array> {
  const model = await getEmbedModel();
  if (!model) {
    throw new Error(
      'No embedding model configured. Set models.defaults.embedding in config/app.yaml',
    );
  }

  const result = await embed({
    model,
    value: text,
  });

  return new Float32Array(result.embedding);
}

/**
 * Batch-embed multiple texts. Returns an array of Float32Array embeddings
 * in the same order as the input texts.
 */
export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  const model = await getEmbedModel();
  if (!model) {
    throw new Error(
      'No embedding model configured. Set models.defaults.embedding in config/app.yaml',
    );
  }

  const result = await embedMany({
    model,
    values: texts,
  });

  return result.embeddings.map((e) => new Float32Array(e));
}
