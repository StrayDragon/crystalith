// QA presets — stats registry + parseStatsPresetOutput + /prompt: directive (c48 / Wave D.5).
import { describe, expect, it } from 'bun:test';

import {
  STATS_SYSTEM_PROMPT,
  listPresets,
  parsePromptDirective,
  parseStatsPresetOutput,
  resolvePreset,
} from '../../src/features/qa/presets.ts';

const validStatsJson = JSON.stringify({
  fallback_markdown: 'Sales grew [1].',
  chart: {
    title: 'Revenue',
    unit: 'USD',
    items: [
      { label: 'Q1', value: 10 },
      { label: 'Q2', value: 20 },
    ],
  },
  table: {
    columns: ['Q', 'Amt'],
    rows: [
      ['Q1', 10],
      ['Q2', 20],
    ],
  },
});

describe('listPresets / resolvePreset (stats)', () => {
  it('includes builtin stats among presets', () => {
    const names = listPresets().map((p) => p.name);
    expect(names).toContain('stats');
    expect(names).toContain('default');
  });

  it('resolvePreset(stats) returns STATS_SYSTEM_PROMPT without directive injection', () => {
    const prompt = resolvePreset('stats', 'Sources_only');
    expect(prompt).toBe(STATS_SYSTEM_PROMPT);
    expect(prompt).toContain('fallback_markdown');
    expect(prompt).not.toContain('CRITICAL: Only use information');
  });
});

describe('parsePromptDirective', () => {
  it('extracts /prompt:stats and remaining query', () => {
    expect(parsePromptDirective('/prompt:stats 销售数据')).toEqual({
      preset: 'stats',
      question: '销售数据',
    });
  });

  it('lowercases preset id', () => {
    expect(parsePromptDirective('/prompt:STATS hello').preset).toBe('stats');
  });

  it('falls back to body preset when no directive', () => {
    expect(parsePromptDirective('plain question', 'analysis')).toEqual({
      preset: 'analysis',
      question: 'plain question',
    });
  });

  it('bare /prompt:stats without trailing space does not match', () => {
    expect(parsePromptDirective('/prompt:stats')).toEqual({
      preset: 'default',
      question: '/prompt:stats',
    });
  });
});

describe('parseStatsPresetOutput', () => {
  it('accepts valid chart+table JSON', () => {
    const parsed = parseStatsPresetOutput(validStatsJson);
    expect(parsed).not.toBeNull();
    expect(parsed!.fallback_markdown).toBe('Sales grew [1].');
    expect(parsed!.chart.title).toBe('Revenue');
    expect(parsed!.chart.items).toHaveLength(2);
    expect(parsed!.table?.columns).toEqual(['Q', 'Amt']);
  });

  it('extracts JSON from surrounding prose / fences', () => {
    const wrapped = `Sure.\n\`\`\`json\n${validStatsJson}\n\`\`\`\n`;
    const parsed = parseStatsPresetOutput(wrapped);
    expect(parsed?.chart.title).toBe('Revenue');
  });

  it('returns null for empty / invalid / incomplete payloads', () => {
    expect(parseStatsPresetOutput('')).toBeNull();
    expect(parseStatsPresetOutput('not json')).toBeNull();
    expect(parseStatsPresetOutput('{"fallback_markdown":"x"}')).toBeNull();
    expect(
      parseStatsPresetOutput(
        JSON.stringify({
          fallback_markdown: '',
          chart: { title: 't', items: [{ label: 'a', value: 1 }] },
        }),
      ),
    ).toBeNull();
    expect(
      parseStatsPresetOutput(
        JSON.stringify({
          fallback_markdown: 'ok',
          chart: { title: 't', items: [] },
        }),
      ),
    ).toBeNull();
  });
});
