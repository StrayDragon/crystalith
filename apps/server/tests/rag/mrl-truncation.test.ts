// c133 r494（embedding-mrl-truncation）：截断双路径行为锁测。
// 路径①网关认 dimensions（透传 + 模长校验 warn）；路径②网关忽略/拒绝时
// 客户端切片 + L2 再归一化（降级 warn 一次，后续不再带参）；开关关闭零变化。
import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

interface EmbedCall {
  dimensions?: number;
  value?: string;
  values?: string[];
}

const calls: EmbedCall[] = [];
let gatewayBehavior: 'honor' | 'ignore' | 'reject' = 'honor';
let gatewayNorm: number = 1; // 路径①下返回向量的模长（>1 模拟网关违约）

function unitVec(dims: number, norm = 1): number[] {
  const raw = Math.sqrt(dims);
  return Array.from({ length: dims }, () => (1 / raw) * norm);
}

mock.module('ai', () => ({
  embed: async (args: EmbedCall) => {
    calls.push(args);
    if (gatewayBehavior === 'reject' && args.dimensions !== undefined) {
      throw new Error('gateway: unknown parameter dimensions');
    }
    const dims =
      gatewayBehavior === 'honor' && args.dimensions !== undefined ? args.dimensions : 768;
    return { embedding: unitVec(dims, gatewayNorm) };
  },
  embedMany: async (args: EmbedCall) => {
    calls.push(args);
    if (gatewayBehavior === 'reject' && args.dimensions !== undefined) {
      throw new Error('gateway: unknown parameter dimensions');
    }
    const dims =
      gatewayBehavior === 'honor' && args.dimensions !== undefined ? args.dimensions : 768;
    return { embeddings: (args.values ?? []).map(() => unitVec(dims, gatewayNorm)) };
  },
}));

import { createEmbeddingEngine } from '../../src/rag/embedding-engine.ts';
import { l2Norm } from '../../src/rag/vector-truncate.ts';
import { logger } from '../../src/shared/logger.ts';

// 能力声明与 gateway mock 对齐：dims 768、mrlDims 含 256。
const CAP = { dims: 768, mrlDims: [768, 512, 256, 128], prefixPreset: undefined } as const;
const MODEL = {} as never;

describe('mrl truncation engine (r494)', () => {
  let warns: string[];
  const spy = () =>
    spyOn(logger, 'warn').mockImplementation((...rest: unknown[]) => {
      warns.push(String(rest[0]));
    });

  beforeEach(() => {
    calls.length = 0;
    gatewayBehavior = 'honor';
    gatewayNorm = 1;
    warns = [];
  });

  it('off: verbatim passthrough — no dimensions param, declared dims, zero change', async () => {
    const s = spy();
    const engine = createEmbeddingEngine(MODEL, CAP);
    const v = await engine.embedQuery('q');
    expect(v).toHaveLength(768);
    expect(calls[0]!.dimensions).toBeUndefined();
    expect(warns).toEqual([]);
    s.mockRestore();
  });

  it('path-1: gateway honors dimensions — passthrough at target dims, no warn', async () => {
    const s = spy();
    const engine = createEmbeddingEngine(MODEL, CAP, { targetDims: 256 });
    const v = await engine.embedQuery('q');
    expect(v).toHaveLength(256);
    expect(l2Norm(v)).toBeCloseTo(1, 3);
    expect(calls[0]!.dimensions).toBe(256);
    expect(warns).toEqual([]);
    s.mockRestore();
  });

  it('path-2: gateway ignores dimensions — slice + renormalize, warn once, stop sending param', async () => {
    gatewayBehavior = 'ignore';
    const s = spy();
    const engine = createEmbeddingEngine(MODEL, CAP, { targetDims: 256 });
    const first = await engine.embedQuery('q');
    expect(first).toHaveLength(256);
    expect(l2Norm(first)).toBeCloseTo(1, 5);
    expect(warns.filter((w) => w.includes('ignored dimensions'))).toHaveLength(1);

    const second = await engine.embedQuery('q2');
    expect(second).toHaveLength(256);
    expect(l2Norm(second)).toBeCloseTo(1, 5);
    // 降级后不再携带 dimensions 参数
    expect(calls[1]!.dimensions).toBeUndefined();
    expect(warns.filter((w) => w.includes('ignored dimensions'))).toHaveLength(1);
    s.mockRestore();
  });

  it('path-2 (reject): gateway throws on the param — retry without it and degrade', async () => {
    gatewayBehavior = 'reject';
    const s = spy();
    const engine = createEmbeddingEngine(MODEL, CAP, { targetDims: 256 });
    const v = await engine.embedQuery('q');
    expect(v).toHaveLength(256);
    expect(l2Norm(v)).toBeCloseTo(1, 5);
    expect(calls).toHaveLength(2); // 带参失败 + 去参重试
    expect(calls[1]!.dimensions).toBeUndefined();
    expect(warns.some((w) => w.includes('rejected dimensions'))).toBe(true);
    s.mockRestore();
  });

  it('path-1 norm violation: denormalized gateway vector warns but is not blocked', async () => {
    gatewayNorm = 2;
    const s = spy();
    const engine = createEmbeddingEngine(MODEL, CAP, { targetDims: 256 });
    const v = await engine.embedQuery('q');
    expect(v).toHaveLength(256);
    expect(l2Norm(v)).toBeCloseTo(2, 3); // 原样入库，不阻断（warn 可观测）
    expect(warns.some((w) => w.includes('normalization'))).toBe(true);
    s.mockRestore();
  });

  it('embedDocuments keeps the same dual-path semantics batch-wise', async () => {
    gatewayBehavior = 'ignore';
    const s = spy();
    const engine = createEmbeddingEngine(MODEL, CAP, { targetDims: 256 });
    const vs = await engine.embedDocuments(['a', 'b'], { titles: ['t1', 't2'] });
    expect(vs).toHaveLength(2);
    for (const v of vs) {
      expect(v).toHaveLength(256);
      expect(l2Norm(v)).toBeCloseTo(1, 5);
    }
    expect(warns.filter((w) => w.includes('ignored dimensions'))).toHaveLength(1);
    s.mockRestore();
  });
});
