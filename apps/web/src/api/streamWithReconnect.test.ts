/**
 * c64 / r13: bounded-reconnect state machine for Run SSE.
 * Fake timers drive the 1s/2s/4s backoff deterministically.
 *
 * Mock reason: fake timers (rs.useFakeTimers) replace the wall-clock backoff
 * delays so the reconnect ladder is driven deterministically in tests.
 */
import { describe, expect, it, rs } from '@rstest/core';

import { streamWithReconnect, type SseEvent, type StreamReconnectState } from './stream';

const ev = (n: number): SseEvent => ({ event: 'status', data: { status: n } });

function failingStream(): AsyncGenerator<SseEvent> {
  // Mock reason: a dropped connection surfaces as a rejected `next()` on the
  // stream's async iterator — exactly what streamWithReconnect must survive.
  return {
    [Symbol.asyncIterator]() {
      return {
        next: () => Promise.reject(new Error('connection lost')),
      };
    },
  } as AsyncGenerator<SseEvent>;
}

describe('streamWithReconnect (c64 / r13)', () => {
  it('retries with backoff until reconcile reports terminal', async () => {
    rs.useFakeTimers();
    try {
      let calls = 0;
      const states: Array<[StreamReconnectState, number]> = [];
      const iter = streamWithReconnect(
        () => {
          calls += 1;
          if (calls < 3) return failingStream();
          return (async function* () {
            yield ev(1);
          })();
        },
        {
          reconcile: async () => calls >= 3,
          onStateChange: (state, attempt) => states.push([state, attempt]),
        },
      );

      const first = iter.next();
      await rs.advanceTimersByTimeAsync(1000 + 2000 + 10);
      const r1 = await first;
      expect(r1.done).toBe(false);
      expect(r1.value).toEqual(ev(1));

      const second = iter.next();
      const r2 = await second;
      expect(r2.done).toBe(true);
      expect(calls).toBe(3);
      expect(states).toEqual([
        ['reconnecting', 1],
        ['reconnecting', 2],
        ['ok', 2],
        ['ok', 2],
      ]);
    } finally {
      rs.useRealTimers();
    }
  });

  it('exhausts attempts, stops, and reports exhausted', async () => {
    rs.useFakeTimers();
    try {
      let calls = 0;
      const states: Array<[StreamReconnectState, number]> = [];
      const iter = streamWithReconnect(
        () => {
          calls += 1;
          return failingStream();
        },
        {
          reconcile: async () => false,
          onStateChange: (state, attempt) => states.push([state, attempt]),
          backoffMs: [1000, 2000],
          maxAttempts: 2,
        },
      );

      const done = iter.next();
      await rs.advanceTimersByTimeAsync(1000 + 2000 + 10);
      const r = await done;
      expect(r.done).toBe(true);
      expect(calls).toBe(3);
      expect(states.at(-1)).toEqual(['exhausted', 2]);
    } finally {
      rs.useRealTimers();
    }
  });

  it('reconcile terminal after first stream ends → no retry', async () => {
    let calls = 0;
    const states: Array<[StreamReconnectState, number]> = [];
    const iter = streamWithReconnect(
      () => {
        calls += 1;
        return (async function* () {
          yield ev(1);
        })();
      },
      {
        reconcile: async () => true,
        onStateChange: (state, attempt) => states.push([state, attempt]),
      },
    );

    const r1 = await iter.next();
    expect(r1.value).toEqual(ev(1));
    const r2 = await iter.next();
    expect(r2.done).toBe(true);
    expect(calls).toBe(1);
    expect(states).toEqual([
      ['ok', 0],
      ['ok', 0],
    ]);
  });

  it('abort stops immediately without subscribing or reconciling', async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    let reconciles = 0;
    const iter = streamWithReconnect(
      () => {
        calls += 1;
        return failingStream();
      },
      {
        reconcile: async () => {
          reconciles += 1;
          return false;
        },
        signal: controller.signal,
      },
    );

    const r = await iter.next();
    expect(r.done).toBe(true);
    expect(calls).toBe(0);
    expect(reconciles).toBe(0);
  });

  it('abort mid-stream stops without a trailing reconcile', async () => {
    const controller = new AbortController();
    let reconciles = 0;
    const iter = streamWithReconnect(
      () => {
        return (async function* () {
          yield ev(1);
          controller.abort();
        })();
      },
      {
        signal: controller.signal,
        reconcile: async () => {
          reconciles += 1;
          return false;
        },
      },
    );

    const r1 = await iter.next();
    expect(r1.value).toEqual(ev(1));
    const r2 = await iter.next();
    expect(r2.done).toBe(true);
    expect(reconciles).toBe(0);
  });
});
