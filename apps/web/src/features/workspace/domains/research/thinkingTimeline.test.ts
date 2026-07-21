import { expect, test } from 'vitest';

import { buildThinkingTimeline, stepOutputData } from './thinkingTimeline';
import type { SSEEvent } from './useResearch';

test('stepOutputData returns null when outputData is missing or null', () => {
  expect(stepOutputData({ type: 'plan', iteration: 1 })).toBeNull();
  expect(stepOutputData({ type: 'plan', iteration: 1, outputData: null })).toBeNull();
});

test('stepOutputData returns outputData object', () => {
  const data = { reasoning: 'why' };
  expect(stepOutputData({ type: 'plan', iteration: 1, outputData: data })).toEqual(data);
});

test('active session prefers SSE thinking/connection events over steps', () => {
  const sseEvents: SSEEvent[] = [
    {
      type: 'thinking',
      data: { type: 'reasoning', message: 'live thought', iteration: 1 },
    },
    {
      type: 'connection',
      data: { status: 'reconnected', message: '已重连' },
    },
    {
      type: 'status',
      data: { status: 'searching', iteration: 1 },
    },
  ];

  const timeline = buildThinkingTimeline({
    sseEvents,
    steps: [
      {
        type: 'plan',
        iteration: 1,
        outputData: { reasoning: 'should be ignored when SSE present' },
      },
    ],
    topic: 'Ignored',
    maxIterations: 3,
    status: 'searching',
  });

  expect(timeline).toEqual([
    {
      type: 'reasoning',
      message: 'live thought',
      timestamp: 0,
      iteration: 1,
      queries: undefined,
    },
    {
      type: 'connection',
      message: '🔌 已重连',
      timestamp: 1,
    },
  ]);
});

test('completed session reconstructs full history from steps', () => {
  const timeline = buildThinkingTimeline({
    sseEvents: [
      {
        type: 'thinking',
        data: { type: 'reasoning', message: 'stale sse', iteration: 1 },
      },
    ],
    steps: [
      {
        type: 'plan',
        iteration: 1,
        outputData: {
          reasoning: 'first plan',
          queries: [{ query: 'q1' }, { query: 'q2' }],
        },
      },
      {
        type: 'search',
        iteration: 1,
        outputData: { resultCount: 10, newResults: 4 },
      },
      {
        type: 'analyze',
        iteration: 1,
        outputData: {
          coverageEstimate: 0.42,
          summary: 'enough evidence',
          needMore: true,
        },
      },
      {
        type: 'summary',
        iteration: 1,
        outputData: { reportLength: 1200 },
      },
    ],
    topic: '量子计算',
    maxIterations: 3,
    status: 'completed',
  });

  expect(timeline.map((item) => item.type)).toEqual([
    'start',
    'reasoning',
    'plan_generated',
    'search_complete',
    'analysis_complete',
    'insight',
    'decision',
    'report_complete',
    'completed',
  ]);
  expect(timeline[0]).toMatchObject({
    type: 'start',
    message: '🚀 开始深度研究「量子计算」',
    iteration: 1,
  });
  expect(timeline.find((item) => item.type === 'plan_generated')).toMatchObject({
    message: '📋 已生成 2 个搜索查询',
    queries: ['q1', 'q2'],
  });
  expect(timeline.find((item) => item.type === 'search_complete')?.message).toContain(
    '获取 10 条结果，新增 4 条',
  );
  expect(timeline.find((item) => item.type === 'analysis_complete')?.message).toContain('42%');
  expect(timeline.find((item) => item.type === 'decision')?.message).toContain('需要更多搜索');
  expect(timeline.find((item) => item.type === 'report_complete')?.message).toContain('1200 字');
});

test('insight truncates long analyze summary at 150 chars', () => {
  const longSummary = 'x'.repeat(160);
  const timeline = buildThinkingTimeline({
    sseEvents: [],
    steps: [
      {
        type: 'analyze',
        iteration: 1,
        outputData: { coverageEstimate: 1, summary: longSummary, needMore: false },
      },
    ],
    topic: 'T',
    maxIterations: 1,
    status: 'completed',
  });

  const insight = timeline.find((item) => item.type === 'insight');
  expect(insight?.message).toBe(`💡 ${'x'.repeat(150)}...`);
});

test('decision is omitted when analyze needMore but iteration is final', () => {
  const timeline = buildThinkingTimeline({
    sseEvents: [],
    steps: [
      {
        type: 'analyze',
        iteration: 2,
        outputData: { coverageEstimate: 0.9, summary: 'done', needMore: true },
      },
    ],
    topic: 'T',
    maxIterations: 2,
    status: 'completed',
  });

  expect(timeline.some((item) => item.type === 'decision')).toBe(false);
});

test('empty inputs yield empty timeline', () => {
  expect(
    buildThinkingTimeline({
      sseEvents: [],
      steps: [],
      topic: 'T',
      maxIterations: 3,
      status: 'planning',
    }),
  ).toEqual([]);
});
