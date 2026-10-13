// Embedding engine — task-prefix presets + dimension assertion (c130).
//
// embedding-runtime r475–r477: prefix templates live in the built-in preset
// table below (SSOT; preset *names* are shared via EMBEDDING_PREFIX_PRESET_NAMES
// in @crystalith/shared so config validation and the engine cannot drift).
// Models without a declaration embed verbatim (r476). Every returned vector is
// checked against the declared `dims` before callers can persist it (r477).
// Model resolution stays in embedder.ts (facade).
import type { EmbeddingModelV4 } from '@ai-sdk/provider';
import type { EMBEDDING_PREFIX_PRESET_NAMES, ModelEmbeddingCapability } from '@crystalith/shared';
import { embed, embedMany } from 'ai';

/** Valid preset names — keyed off the shared catalog SSOT (compile-time sync). */
type EmbeddingPrefixPresetName = (typeof EMBEDDING_PREFIX_PRESET_NAMES)[number];

interface EmbeddingPrefixPreset {
  /** Query-role template (retrieval queries). */
  query: (q: string) => string;
  /** Document-role template (`title` defaults to `none` when absent). */
  document: (title: string | undefined, text: string) => string;
}

const PREFIX_PRESETS = {
  embeddinggemma2: {
    query: (q: string) => `task: search result | query: ${q}`,
    document: (title: string | undefined, text: string) =>
      `title: ${title ?? 'none'} | text: ${text}`,
  },
} as const satisfies Record<EmbeddingPrefixPresetName, EmbeddingPrefixPreset>;

export interface EmbeddingEngine {
  /** Embed a retrieval query (query role — query prefix template). */
  embedQuery(text: string): Promise<Float32Array>;
  /** Embed documents (document role — per-index title, default `none`). */
  embedDocuments(texts: string[], opts?: { titles?: string[] }): Promise<Float32Array[]>;
}

/**
 * Create an engine bound to a provider embedding model and the model's
 * (possibly absent) embedding capability declaration. Pure factory — the
 * model singleton/cache stays in the embedder facade.
 */
export function createEmbeddingEngine(
  model: EmbeddingModelV4,
  capability: ModelEmbeddingCapability | null | undefined,
): EmbeddingEngine {
  const preset = capability?.prefixPreset ? PREFIX_PRESETS[capability.prefixPreset] : undefined;
  const declaredDims = capability?.dims;

  function assertDims(vector: Float32Array): Float32Array {
    if (declaredDims !== undefined && vector.length !== declaredDims) {
      throw new Error(
        `嵌入维度与模型声明不一致：声明 ${declaredDims} 维，provider 实际返回 ${vector.length} 维`,
      );
    }
    return vector;
  }

  return {
    async embedQuery(text: string): Promise<Float32Array> {
      const value = preset ? preset.query(text) : text;
      const result = await embed({ model, value });
      return assertDims(new Float32Array(result.embedding));
    },

    async embedDocuments(texts: string[], opts): Promise<Float32Array[]> {
      const values = texts.map((text, i) =>
        preset ? preset.document(opts?.titles?.[i], text) : text,
      );
      const result = await embedMany({ model, values });
      return result.embeddings.map((e) => assertDims(new Float32Array(e)));
    },
  };
}
