import { describe, expect, test } from '@rstest/core';

import { parseSseBlock, streamRequest } from './stream';

describe('parseSseBlock', () => {
  test('pairs event name with JSON data', () => {
    const event = parseSseBlock('event: chunk\ndata: {"text":"hello"}');
    expect(event).toEqual({ event: 'chunk', data: { text: 'hello' } });
  });

  test('parses done event with nested payload', () => {
    const event = parseSseBlock(
      'event: done\ndata: {"messageId":42,"citations":[],"evidence":false}',
    );
    expect(event?.event).toBe('done');
    expect(event?.data).toEqual({ messageId: 42, citations: [], evidence: false });
  });

  test('defaults event name to message when omitted', () => {
    const event = parseSseBlock('data: {"ok":true}');
    expect(event).toEqual({ event: 'message', data: { ok: true } });
  });

  test('joins multi-line data fields', () => {
    const event = parseSseBlock('event: error\ndata: {"message":"line1"}\ndata: ignored-second');
    // Second data line makes JSON invalid → raw joined string
    expect(event?.event).toBe('error');
    expect(typeof event?.data).toBe('string');
  });

  test('returns null for event-only blocks', () => {
    expect(parseSseBlock('event: ping')).toBeNull();
  });

  test('ignores comment lines', () => {
    const event = parseSseBlock(': keep-alive\nevent: chunk\ndata: {"text":"x"}');
    expect(event).toEqual({ event: 'chunk', data: { text: 'x' } });
  });
});

describe('streamRequest non-2xx error enrichment', () => {
  test('appends the server ErrorEnvelope reason to the transport message', async () => {
    const originalFetch = globalThis.fetch;
    const stub = (async () =>
      new Response(
        JSON.stringify({
          errorCode: 'INVALID_REQUEST',
          message: 'Missing query after /prompt directive',
        }),
        { status: 400, statusText: 'Bad Request' },
      )) as unknown as typeof fetch;
    globalThis.fetch = stub;
    try {
      const error = await streamRequest('/v2/x', { method: 'POST' }).next();
      expect(error.done).toBe(true);
    } catch (thrown) {
      expect((thrown as Error).message).toBe(
        'SSE request failed: 400 Bad Request — Missing query after /prompt directive',
      );
      expect((thrown as { status?: number }).status).toBe(400);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('falls back to status text alone for non-JSON bodies', async () => {
    const originalFetch = globalThis.fetch;
    const stub = (async () =>
      new Response('<html>gateway error</html>', {
        status: 502,
        statusText: 'Bad Gateway',
      })) as unknown as typeof fetch;
    globalThis.fetch = stub;
    try {
      await streamRequest('/v2/x').next();
      expect.unreachable('should have thrown');
    } catch (thrown) {
      expect((thrown as Error).message).toBe('SSE request failed: 502 Bad Gateway');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
