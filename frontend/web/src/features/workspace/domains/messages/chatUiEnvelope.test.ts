import { expect, test } from 'vitest';

import {
  CHAT_UI_ENVELOPE_DELIMITER,
  parseChatUiEnvelope,
} from './chatUiEnvelope';

test('parseChatUiEnvelope returns null envelope when no delimiter', () => {
  const result = parseChatUiEnvelope('hello');
  expect(result.envelope).toBeNull();
  expect(result.fallbackText).toBe('hello');
});

test('parseChatUiEnvelope parses a valid envelope', () => {
  const content =
    'fallback' +
    CHAT_UI_ENVELOPE_DELIMITER +
    JSON.stringify({
      schema: 'crystalith.ui.message.v1',
      parts: [{ type: 'text', format: 'markdown', text: 'ok' }],
    });

  const result = parseChatUiEnvelope(content);
  expect(result.fallbackText).toBe('fallback');
  expect(result.envelope?.schema).toBe('crystalith.ui.message.v1');
  expect(result.envelope?.parts.length).toBe(1);
});

test('parseChatUiEnvelope falls back when JSON is invalid', () => {
  const content = 'fallback' + CHAT_UI_ENVELOPE_DELIMITER + '{not-json}';
  const result = parseChatUiEnvelope(content);
  expect(result.envelope).toBeNull();
  expect(result.fallbackText).toBe('fallback');
});

test('parseChatUiEnvelope enforces max parts', () => {
  const parts = Array.from({ length: 51 }, () => ({
    type: 'text',
    format: 'markdown',
    text: 'x',
  }));
  const content =
    'fallback' +
    CHAT_UI_ENVELOPE_DELIMITER +
    JSON.stringify({ schema: 'crystalith.ui.message.v1', parts });
  const result = parseChatUiEnvelope(content);
  expect(result.envelope).toBeNull();
});

test('parseChatUiEnvelope enforces max json bytes', () => {
  const big = 'a'.repeat(220_000);
  const content =
    'fallback' +
    CHAT_UI_ENVELOPE_DELIMITER +
    JSON.stringify({
      schema: 'crystalith.ui.message.v1',
      parts: [],
      meta: { big },
    });
  const result = parseChatUiEnvelope(content);
  expect(result.envelope).toBeNull();
});

test('parseChatUiEnvelope enforces max depth', () => {
  let deep: Record<string, unknown> = {};
  let cursor = deep;
  for (let i = 0; i < 30; i += 1) {
    const next: Record<string, unknown> = {};
    cursor.n = next;
    cursor = next;
  }
  const content =
    'fallback' +
    CHAT_UI_ENVELOPE_DELIMITER +
    JSON.stringify({
      schema: 'crystalith.ui.message.v1',
      parts: [],
      meta: deep,
    });
  const result = parseChatUiEnvelope(content);
  expect(result.envelope).toBeNull();
});

