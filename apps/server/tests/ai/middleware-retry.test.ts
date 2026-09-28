// covers: r183, r184
// AI 调用重试（ai/middleware.ts withRetry）：
//   r183 — 解析并遵守 Retry-After 头；可重试状态码集合含 408/409/425/429/500/502/503/504
//   r184 — total timeout 预算 + max delay 上限（退避不超过 maxDelayMs，总时间不超过预算）
//
// 通过 fake LanguageModelV4 注入脚本化行为；捕获 setTimeout 记录退避延迟并立即放行，
// 使断言确定（不依赖真实时钟等待）。
import { afterAll, describe, expect, it } from 'bun:test';

import type { LanguageModelV4 } from '@ai-sdk/provider';

import { withRetry } from '../../src/ai/middleware.ts';
import { resetConfig } from '../../src/shared/config.ts';

resetConfig({ models: { defaults: {}, available: [] }, raw: {} });

type Behavior = 'ok' | Error;

function scriptModel(behaviors: Behavior[]) {
  let calls = 0;
  const doGenerate = async () => {
    const index = Math.min(calls, behaviors.length - 1);
    calls++;
    const behavior = behaviors[index]!;
    if (behavior === 'ok') {
      return { content: [], finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } };
    }
    throw behavior;
  };
  const model = {
    specificationVersion: 'v4',
    provider: 'fake',
    modelId: 'fake-model',
    doGenerate,
    doStream: async () => {
      throw new Error('doStream unused in retry tests');
    },
  } as unknown as LanguageModelV4;
  return { model, callCount: () => calls };
}

function statusError(statusCode: number, headers?: Record<string, string>): Error {
  const err = new Error(`http ${statusCode}`) as Error & {
    statusCode?: number;
    responseHeaders?: Record<string, string>;
  };
  err.statusCode = statusCode;
  if (headers) err.responseHeaders = headers;
  return err;
}

// --- sleep capture: record delay, fire callback immediately via microtask ---
const recordedDelays: number[] = [];
const originalSetTimeout = globalThis.setTimeout;

function captureSleep(): void {
  recordedDelays.length = 0;
  globalThis.setTimeout = ((fn: (...args: unknown[]) => void, ms?: number) => {
    recordedDelays.push(typeof ms === 'number' ? ms : 0);
    queueMicrotask(() => fn());
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;
}

afterAll(() => {
  globalThis.setTimeout = originalSetTimeout;
});

async function generateOnce(model: LanguageModelV4): Promise<unknown> {
  const wrapped = withRetry(model, {
    maxRetries: 3,
    baseDelayMs: 5000,
    maxDelayMs: 10_000,
  });
  return wrapped.doGenerate({} as Parameters<LanguageModelV4['doGenerate']>[0]);
}

describe('r183: Retry-After honored', () => {
  it('numeric Retry-After (seconds) wins over exponential backoff', async () => {
    captureSleep();
    const { model, callCount } = scriptModel([statusError(429, { 'retry-after': '7' }), 'ok']);

    const result = await generateOnce(model);
    expect(result).toBeTruthy();
    expect(callCount()).toBe(2);
    // 按指示等待 7000ms，而非指数退避的 5000ms。
    expect(recordedDelays).toEqual([7000]);
  });

  it('HTTP-date Retry-After is parsed into remaining ms', async () => {
    captureSleep();
    const date = new Date(Date.now() + 8000).toUTCString();
    const { model, callCount } = scriptModel([statusError(503, { 'retry-after': date }), 'ok']);

    await generateOnce(model);
    expect(callCount()).toBe(2);
    expect(recordedDelays.length).toBe(1);
    // 剩余时间 ≈ 8000ms，且不是指数退避的 5000ms。
    expect(recordedDelays[0]!).toBeGreaterThan(7000);
    expect(recordedDelays[0]!).toBeLessThanOrEqual(8000);
  });

  it('unparseable Retry-After falls back to exponential backoff', async () => {
    captureSleep();
    const { model } = scriptModel([statusError(429, { 'retry-after': 'soon' }), 'ok']);

    await generateOnce(model);
    expect(recordedDelays).toEqual([5000]);
  });
});

describe('r183: retryable status code set', () => {
  for (const status of [408, 409, 425, 429, 500, 502, 503, 504]) {
    it(`retries on ${status} and succeeds`, async () => {
      captureSleep();
      const { model, callCount } = scriptModel([statusError(status), 'ok']);

      const result = await generateOnce(model);
      expect(result).toBeTruthy();
      expect(callCount()).toBe(2);
    });
  }

  it('does not retry non-retryable 400 and rethrows the original error', async () => {
    captureSleep();
    const { model, callCount } = scriptModel([statusError(400), 'ok']);

    await generateOnce(model).catch((error: Error) => {
      expect(error.message).toBe('http 400');
    });
    expect(callCount()).toBe(1);
    expect(recordedDelays).toEqual([]);
  });
});

describe('r184: timeout budget and max delay', () => {
  it('caps backoff at maxDelayMs', async () => {
    captureSleep();
    const { model, callCount } = scriptModel([statusError(429), statusError(429), 'ok']);

    const wrapped = withRetry(model, {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 150,
    });
    await wrapped.doGenerate({} as Parameters<LanguageModelV4['doGenerate']>[0]);

    expect(callCount()).toBe(3);
    // 指数序列 100, 200 — 第二次被 maxDelayMs 截断为 150。
    expect(recordedDelays).toEqual([100, 150]);
  });

  it('stops retrying once the total timeout budget is exceeded', async () => {
    captureSleep();

    // 每次尝试耗时 30ms（真实时钟），预算 50ms → 第二次尝试后超预算。
    let calls = 0;
    const doGenerate = async () => {
      calls++;
      await Bun.sleep(30);
      throw statusError(429, { 'retry-after': '0' });
    };
    const model = {
      specificationVersion: 'v4',
      provider: 'fake',
      modelId: 'fake-model',
      doGenerate,
      doStream: async () => {
        throw new Error('doStream unused');
      },
    } as unknown as LanguageModelV4;

    const wrapped = withRetry(model, {
      maxRetries: 100,
      baseDelayMs: 10,
      maxDelayMs: 20,
      totalTimeoutMs: 50,
    });

    let message = '';
    try {
      await wrapped.doGenerate({} as Parameters<LanguageModelV4['doGenerate']>[0]);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('Retry budget exceeded');
    // 预算阻止了 100 次重试的无限循环（只跑了 2 次尝试）。
    expect(calls).toBe(2);
  });
});
