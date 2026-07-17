import { describe, expect, test } from 'vitest';

import { parseSseBlock } from './stream';

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
