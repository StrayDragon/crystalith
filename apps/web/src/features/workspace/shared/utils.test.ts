import { beforeEach, expect, test, rs } from '@rstest/core';

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
  rs.useRealTimers();
});

test('normalizeMessage maps role, citations, and chunk ids', () => {
  const message = normalizeMessage({
    id: 42,
    role: 'assistant',
    content: 'Answer',
    citations: [
      {
        chunkId: 12,
        chunkIndex: 1,
        sourceName: 'Doc A',
        snippet: 'Snippet',
      },
      {
        chunkId: null,
        chunkIndex: 2,
        sourceName: 'Doc B',
        snippet: 'Snippet',
      },
    ],
  } as any);

  expect(message.role).toBe('assistant');
  expect(message.citations).toHaveLength(2);
  expect(message.citationChunkIds).toEqual([12]);
});

test('normalizeCitation maps wire camelCase to UI camelCase', () => {
  const citation = normalizeCitation({
    sourceId: 42,
    sourceName: 'excel-column-residency.md',
    chunkId: 7,
    chunkIndex: 2,
    pageNumber: 3,
    paragraphIndex: 1,
    snippet: 'snippet',
    score: 0.9,
  });

  expect(citation).toMatchObject({
    sourceId: 42,
    sourceName: 'excel-column-residency.md',
    chunkId: 7,
    chunkIndex: 2,
    pageNumber: 3,
    paragraphIndex: 1,
    snippet: 'snippet',
    score: 0.9,
  });
});

test('normalizeCitation handles missing chunk id', () => {
  const citation = normalizeCitation({
    chunkId: null,
    chunkIndex: 3,
    sourceName: 'Doc',
    snippet: 'Snippet',
  } as any);

  expect(citation.id).toBe('3');
  expect(citation.chunkId).toBeNull();
  expect(citation.sourceName).toBe('Doc');
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
  rs.useFakeTimers();
  const now = new Date('2024-06-01T12:00:00.000Z');
  rs.setSystemTime(now);

  expect(formatRelativeTime('2024-06-01T12:00:00.000Z')).toBe('刚刚');
  expect(formatRelativeTime('2024-06-01T11:59:00.000Z')).toBe('1 分钟前');
  expect(formatRelativeTime('2024-06-01T10:00:00.000Z')).toBe('2 小时前');
  expect(formatRelativeTime('2024-05-30T12:00:00.000Z')).toBe('2 天前');
  expect(formatRelativeTime(new Date('2024-06-01T11:59:00.000Z'))).toBe('1 分钟前');
});

test('normalizeSource accepts Eden Date timestamps without crashing UI models', () => {
  const source = normalizeSource({
    id: 8,
    filename: 'notes.md',
    mimeType: 'text/markdown',
    status: 'READY',
    chunkCount: 1,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    lastErrorAt: new Date('2024-01-02T00:00:00.000Z'),
  } as any);

  expect(source.createdAtRaw).toBe('2024-01-01T00:00:00.000Z');
  expect(source.lastErrorAt).toBe('2024-01-02T00:00:00.000Z');
  expect(source.createdAt.length).toBeGreaterThan(0);
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
    notebookId: 1,
    type: 'FAQ',
    prompt: 'faq',
    chunkIds: [1],
    content: { items: [{ question: 'Q1', answer: 'A1' }] },
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-01T10:00:00Z',
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
    notebookId: 1,
    type: 'GUIDE',
    prompt: 'guide',
    chunkIds: [1],
    content: { not_modules: true },
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-01T10:00:00Z',
  });

  const content = output.content;
  expect(content).not.toBeNull();
  if (!content) throw new Error('expected content');
  expect(isFallbackOutputPayload(content)).toBe(true);
});
