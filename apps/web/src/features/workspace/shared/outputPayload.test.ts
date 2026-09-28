import { describe, expect, it } from '@rstest/core';

import {
  decodeOutputContent,
  decodeOutputItem,
  formatOutputFieldText,
  getOutputPayloadWarnings,
  getOutputTitle,
  getSlideIdFromOutput,
  isFallbackOutputPayload,
  normalizeOutputPayload,
} from './outputPayload';
import type { OutputItem } from './types';

function createOutput(partial: Partial<OutputItem>): OutputItem {
  return {
    id: 1,
    type: 'FAQ',
    prompt: 'default prompt',
    chunkIds: [1],
    content: {},
    contentLoaded: true,
    createdAt: '2026-01-01 10:00',
    updatedAt: '2026-01-01 10:00',
    ...partial,
  };
}

describe('outputPayload decoder', () => {
  it('narrows FAQ payloads to typed output', () => {
    const output = createOutput({
      type: 'FAQ',
      content: { items: [{ question: 'Q1', answer: 'A1' }] },
    });

    const decoded = decodeOutputItem(output);
    expect(decoded?.type).toBe('FAQ');
    expect(decoded).not.toBeNull();
    if (decoded?.type !== 'FAQ') {
      throw new Error('Expected FAQ output');
    }
    expect(decoded.content.items[0]?.question).toBe('Q1');
  });

  it('returns null for invalid typed payloads', () => {
    const output = createOutput({
      type: 'QUIZ',
      content: { items: [] },
    });

    const decoded = decodeOutputItem(output);
    expect(decoded).toBeNull();
  });

  it('normalizes invalid payload to fallback structure', () => {
    const payload = normalizeOutputPayload('GUIDE', { nope: true });
    expect(isFallbackOutputPayload(payload)).toBe(true);
    expect(getOutputPayloadWarnings(payload)).toContain('Invalid payload for GUIDE');
  });

  it('extracts slide id from typed slides payload (camelCase)', () => {
    const output = createOutput({
      type: 'SLIDES',
      content: { slideId: 99, title: 'Deck' },
    });

    expect(getSlideIdFromOutput(output)).toBe(99);
  });

  it('resolves title by content title then prompt then default', () => {
    const fromContent = createOutput({
      type: 'BRIEFING',
      prompt: 'Prompt title',
      content: { title: 'Content title', sections: [] },
    });
    expect(getOutputTitle(fromContent)).toBe('Content title');

    const fromPrompt = createOutput({
      type: 'BRIEFING',
      prompt: 'Prompt title',
      content: { sections: [] },
    });
    expect(getOutputTitle(fromPrompt)).toBe('Prompt title');

    const fallback = createOutput({
      type: 'BRIEFING',
      prompt: '   ',
      content: { sections: [] },
    });
    expect(getOutputTitle(fallback)).toBe('BRIEFING 输出');
  });

  it('normalizes Eden Date coercion in timeline event dates', () => {
    const decoded = decodeOutputContent('TIMELINE', {
      events: [{ date: new Date(2017, 5, 12), event: 'Launch', description: 'Paper' }],
    });
    expect(decoded?.events[0]?.date).toBe('2017-06-12');
    expect(formatOutputFieldText(new Date(2017, 5, 12))).toBe('2017-06-12');
  });
});

describe('unknown/other branch for plugin output types (r197)', () => {
  // 插件提供的输出类型在客户端类型系统里不存在 — 模拟一个运行期才出现的类型。
  const PLUGIN_TYPE = 'GRAPHRAG' as unknown as Parameters<typeof normalizeOutputPayload>[0];

  it('decodeOutputItem returns null (not a crash) for unknown plugin types', () => {
    const output = createOutput({
      type: PLUGIN_TYPE,
      content: { customField: 'x' },
    });
    expect(decodeOutputItem(output)).toBeNull();
  });

  it('normalizeOutputPayload falls back to the unknown/other payload branch', () => {
    const payload = normalizeOutputPayload(PLUGIN_TYPE, {
      customField: 'x',
      _warnings: ['existing'],
    });

    // 未知分支：_fallback 标记 + 保留原始字段 + 警告合并去重
    expect(isFallbackOutputPayload(payload)).toBe(true);
    const record = payload as unknown as Record<string, unknown>;
    expect(record.customField).toBe('x');
    expect(getOutputPayloadWarnings(payload)).toEqual(['existing', 'Invalid payload for GRAPHRAG']);
  });

  it('unknown branch also covers non-record content (raw passthrough)', () => {
    const payload = normalizeOutputPayload(PLUGIN_TYPE, 'plain-text');
    expect(isFallbackOutputPayload(payload)).toBe(true);
    expect((payload as unknown as Record<string, unknown>).raw).toBe('plain-text');
  });
});
