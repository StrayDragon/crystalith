import { beforeEach, expect, test, vi } from 'vitest';

import { decodeOutputItem, isFallbackOutputPayload } from './outputPayload';
import {
  collectChunkIds,
  formatRelativeTime,
  normalizeCitation,
  normalizeMessage,
  normalizeOutput,
  normalizeSource,
} from './utils';

beforeEach(() => {
  vi.useRealTimers();
});

test('normalizeMessage maps role, citations, and chunk ids', () => {
  const message = normalizeMessage({
    id: 42,
    role: 'assistant',
    content: 'Answer',
    citations: [
      {
        chunk_id: 12,
        chunk_index: 1,
        source_name: 'Doc A',
        snippet: 'Snippet',
      },
      {
        chunk_id: null,
        chunk_index: 2,
        source_name: 'Doc B',
        snippet: 'Snippet',
      },
    ],
  } as any);

  expect(message.role).toBe('assistant');
  expect(message.citations).toHaveLength(2);
  expect(message.citationChunkIds).toEqual([12]);
});

test('normalizeCitation handles missing chunk id', () => {
  const citation = normalizeCitation({
    chunk_id: null,
    chunk_index: 3,
    source_name: 'Doc',
    snippet: 'Snippet',
  } as any);

  expect(citation.id).toBe('3');
  expect(citation.chunkId).toBeNull();
});

test('collectChunkIds filters invalid and non-positive values', () => {
  const ids = collectChunkIds([
    { chunkId: 3 } as any,
    { chunkId: 0 } as any,
    { chunkId: -1 } as any,
    { chunkId: null } as any,
  ]);

  expect(ids).toEqual([3]);
});

test('formatRelativeTime returns humanized values', () => {
  // Mock reason: make time-dependent formatting deterministic (no wall-clock flakiness).
  vi.useFakeTimers();
  const now = new Date('2024-06-01T12:00:00.000Z');
  vi.setSystemTime(now);

  expect(formatRelativeTime('2024-06-01T12:00:00.000Z')).toBe('刚刚');
  expect(formatRelativeTime('2024-06-01T11:59:00.000Z')).toBe('1 分钟前');
  expect(formatRelativeTime('2024-06-01T10:00:00.000Z')).toBe('2 小时前');
  expect(formatRelativeTime('2024-05-30T12:00:00.000Z')).toBe('2 天前');
});

test('normalizeSource resolves type and status labels', () => {
  const source = normalizeSource({
    id: 7,
    filename: 'notes.md',
    mime_type: 'text/markdown',
    status: 'READY',
    chunk_count: 4,
  } as any);

  expect(source.type).toBe('Markdown');
  expect(source.status).toBe('已索引');
  expect(source.statusTone).toBe('READY');
});

test('normalizeOutput keeps typed payload when shape matches', () => {
  const output = normalizeOutput({
    id: 8,
    notebook_id: 1,
    type: 'FAQ',
    prompt: 'faq',
    chunk_ids: [1],
    content: { items: [{ question: 'Q1', answer: 'A1' }] },
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
  });

  const decoded = decodeOutputItem(output);
  expect(decoded?.type).toBe('FAQ');
  if (decoded?.type !== 'FAQ') {
    throw new Error('Expected FAQ output');
  }
  expect(decoded.content.items[0]?.answer).toBe('A1');
});

test('normalizeOutput falls back for invalid payload shape', () => {
  const output = normalizeOutput({
    id: 9,
    notebook_id: 1,
    type: 'GUIDE',
    prompt: 'guide',
    chunk_ids: [1],
    content: { not_modules: true },
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
  });

  expect(isFallbackOutputPayload(output.content)).toBe(true);
});
