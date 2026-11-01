// Embedding engine — task-prefix presets + dimension assertion (c130) + MRL truncation (c133).
//
// embedding-runtime r475–r477: prefix templates live in the built-in preset
// table below (SSOT; preset *names* are shared via EMBEDDING_PREFIX_PRESET_NAMES
// in @crystalith/shared so config validation and the engine cannot drift).
// Models without a declaration embed verbatim (r476). Every returned vector is
// checked against the effective dims before callers can persist it (r477).
// Model resolution stays in embedder.ts (facade).
//
// c133 r494 (embedding-mrl-truncation): when truncation is enabled the engine
// asks the gateway for the target dims (path ①, native `dimensions` param),
// probes the first response, and falls back to client-side slice + L2
// renormalize (path ②) when the gateway ignores or rejects the param.
import type { EmbeddingModelV4 } from '@ai-sdk/provider';
import type { EMBEDDING_PREFIX_PRESET_NAMES, ModelEmbeddingCapability } from '@crystalith/shared';
import { embed, embedMany } from 'ai';

import { logger } from '../shared/logger.ts';
import { l2Norm, sliceNormalize } from './vector-truncate.ts';

/** Valid preset names — keyed off the shared catalog SSOT (compile-time sync). */
type EmbeddingPrefixPresetName = (typeof EMBEDDING_PREFIX_PRESET_NAMES)[number];

interface EmbeddingPrefixPreset {
  /** Query-role template (retrieval queries). */
  query: (q: string) => string;
  /** Document-role template (`title` defaults to `none` when absent). */
  document: (title: string | undefined, text: string) => string;
}

export const PREFIX_PRESETS = {
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

/** c133 r493：截断开关载荷（合法域已在 loadConfig 校验为 mrlDims 成员）。 */
export interface EmbeddingTruncation {
  targetDims: number;
}

const NORM_TOLERANCE = 1e-3;

/**
 * Create an engine bound to a provider embedding model and the model's
 * (possibly absent) embedding capability declaration. Pure factory — the
 * model singleton/cache stays in the embedder facade.
 */
export function createEmbeddingEngine(
  model: EmbeddingModelV4,
  capability: ModelEmbeddingCapability | null | undefined,
  truncation?: EmbeddingTruncation | null,
): EmbeddingEngine {
  const preset = capability?.prefixPreset ? PREFIX_PRESETS[capability.prefixPreset] : undefined;
  const declaredDims = capability?.dims;
  const target = truncation?.targetDims ?? null;
  // 生效维度：截断开启时为目标维度，否则为模型声明维度（r477 断言口径）。
  const effectiveDims = target ?? declaredDims;

  // 网关探测状态（c133 D1）：unprobed → param（网关认 dimensions）/ local（忽略或拒绝）。
  let gatewayMode: 'unprobed' | 'param' | 'local' = 'unprobed';
  let localFallbackLogged = false;

  function assertEffectiveDims(vector: Float32Array): Float32Array {
    if (effectiveDims !== undefined && vector.length !== effectiveDims) {
      // r477 措辞保持不变（截断开启时「声明」口径 = 配置声明的目标维度）。
      throw new Error(
        `嵌入维度与模型声明不一致：声明 ${effectiveDims} 维，provider 实际返回 ${vector.length} 维`,
      );
    }
    return vector;
  }

  /**
   * Finalize a raw provider vector under the truncation policy:
   * - off: verbatim (zero change, r493)
   * - param: gateway already truncated — norm check (warn, not block)
   * - local: slice + L2 renormalize (r494 hard requirement)
   */
  function finalizeVector(raw: readonly number[]): Float32Array {
    if (target === null) {
      return assertEffectiveDims(new Float32Array(raw));
    }
    if (gatewayMode === 'unprobed') {
      gatewayMode = raw.length === target ? 'param' : 'local';
      if (gatewayMode === 'local' && !localFallbackLogged) {
        localFallbackLogged = true;
        logger.warn(
          `[embed] gateway ignored dimensions=${target} (returned ${raw.length}-dim); falling back to client-side MRL truncation`,
        );
      }
    }
    if (gatewayMode === 'local') {
      return assertEffectiveDims(sliceNormalize(raw, target));
    }
    const vec = new Float32Array(raw);
    const drift = Math.abs(l2Norm(vec) - 1);
    if (drift > NORM_TOLERANCE) {
      logger.warn(
        `[embed] gateway returned a ${vec.length}-dim vector with |‖v‖-1|=${drift.toFixed(4)} > ${NORM_TOLERANCE} (dimensions=${target}); check gateway normalization`,
      );
    }
    return assertEffectiveDims(vec);
  }

  /** Call embed/embedMany with the dimensions param while probing/param mode. */
  async function callWithProbe<T>(call: (dimensions?: number) => Promise<T>): Promise<T> {
    if (target === null || gatewayMode === 'local') {
      return call();
    }
    try {
      return await call(target);
    } catch (error) {
      if (gatewayMode === 'unprobed') {
        // 网关可能直接拒绝未知参数——去参重试一次并固定 local（D1 降级）。
        gatewayMode = 'local';
        if (!localFallbackLogged) {
          localFallbackLogged = true;
          logger.warn(
            `[embed] gateway rejected dimensions=${target}; falling back to client-side MRL truncation`,
            error,
          );
        }
        return call();
      }
      throw error;
    }
  }

  return {
    async embedQuery(text: string): Promise<Float32Array> {
      const value = preset ? preset.query(text) : text;
      const result = await callWithProbe((dimensions) => embed({ model, value, dimensions }));
      return finalizeVector(result.embedding);
    },

    async embedDocuments(texts: string[], opts): Promise<Float32Array[]> {
      const values = texts.map((text, i) =>
        preset ? preset.document(opts?.titles?.[i], text) : text,
      );
      const result = await callWithProbe((dimensions) => embedMany({ model, values, dimensions }));
      return result.embeddings.map((e) => finalizeVector(e));
    },
  };
}
