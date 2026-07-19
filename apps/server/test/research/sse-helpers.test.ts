// Wave D.4 — research SSE status/thinking helpers.
import { describe, expect, it } from 'bun:test';

import { statusMessage, thinkingMessageForStep } from '../../src/features/research/sse-events.ts';

describe('research SSE helper messages', () => {
  it('statusMessage covers known statuses', () => {
    expect(statusMessage('planning')).toContain('规划');
    expect(statusMessage('waiting_user')).toContain('审批');
    expect(statusMessage('searching')).toContain('搜索');
    expect(statusMessage('analyzing')).toContain('分析');
    expect(statusMessage('completed')).toContain('完成');
    expect(statusMessage('cancelled')).toContain('取消');
  });

  it('thinkingMessage prefers insight/decision over bare step type', () => {
    expect(
      thinkingMessageForStep({
        type: 'custom_step',
        outputData: { insight: '关键洞察' },
      }),
    ).toBe('关键洞察');
    expect(
      thinkingMessageForStep({
        type: 'custom_step',
        outputData: { decision: '继续搜索' },
      }),
    ).toBe('继续搜索');
    expect(
      thinkingMessageForStep({
        type: 'custom_step',
        outputData: null,
      }),
    ).toBe('custom_step');
  });
});
