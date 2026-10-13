// Embedder — facade over the embedding engine (c130 T4).
//
// Resolves the default embedding model from config once (lazy singleton) and
// wraps it in an engine bound to the same entry's (possibly absent) embedding
// capability declaration. The historical embedSingle / embedBatch surface is
// preserved so consumers stay unchanged; undeclared models embed verbatim
// (r476). Falls back gracefully when no embedding model is configured.
import { resolveEmbeddingModel } from '../ai/providers.ts';
import { getDefaultEmbeddingModel } from '../shared/config.ts';
import { createEmbeddingEngine, type EmbeddingEngine } from './embedding-engine.ts';

let _engine: EmbeddingEngine | null = null;

/**
 * Get or lazily initialize the embedding engine singleton (model resolution +
 * capability binding happen once). Returns null if no embedding model is
 * configured.
 */
async function getEmbedEngine(): Promise<EmbeddingEngine | null> {
  if (_engine) return _engine;

  const config = getDefaultEmbeddingModel();
  if (!config) return null;

  const model = await resolveEmbeddingModel(config);
  _engine = createEmbeddingEngine(model, config.embedding);
  return _engine;
}

function noModelError(): Error {
  return new Error(
    'No embedding model configured. Set models.defaults.embedding in config/app.yaml',
  );
}

/**
 * Drop the cached engine so the next embed re-resolves config. Production
 * never needs this (config is read once per process); tests that `resetConfig`
 * mid-file (e.g. dimension-change rebuild scenarios) use it to simulate a
 * fresh process.
 */
export function resetEmbedderForTests(): void {
  _engine = null;
}

/**
 * Embed a single text string (query role). Returns Float32Array of the embedding.
 */
export async function embedSingle(text: string): Promise<Float32Array> {
  const engine = await getEmbedEngine();
  if (!engine) throw noModelError();
  return engine.embedQuery(text);
}

/**
 * Batch-embed multiple texts (document role). Returns an array of Float32Array
 * embeddings in the same order as the input texts. `opts.titles` optionally
 * carries per-text titles (e.g. source filenames) for document prefixes.
 */
export async function embedBatch(
  texts: string[],
  opts?: { titles?: string[] },
): Promise<Float32Array[]> {
  const engine = await getEmbedEngine();
  if (!engine) throw noModelError();
  return engine.embedDocuments(texts, opts);
}
