// Wave D.4 — research SSE status/thinking helpers.
import { describe, expect, it } from 'bun:test';

import {
  __testStatusMessage,
  __testThinkingMessageForStep,
} from '../../src/features/research/router.ts';

describe('research SSE helper messages', () => {
  it('statusMessage covers known statuses', () => {
    expect(__testStatusMessage('planning')).toContain('规划');
    expect(__testStatusMessage('waiting_user')).toContain('审批');
    expect(__testStatusMessage('searching')).toContain('搜索');
    expect(__testStatusMessage('analyzing')).toContain('分析');
    expect(__testStatusMessage('completed')).toContain('完成');
    expect(__testStatusMessage('cancelled')).toContain('取消');
  });

  it('thinkingMessage prefers insight/decision over bare step type', () => {
    expect(
      __testThinkingMessageForStep({
        type: 'custom_step',
        outputData: { insight: '关键洞察' },
      }),
    ).toBe('关键洞察');
    expect(
      __testThinkingMessageForStep({
        type: 'custom_step',
        outputData: { decision: '继续搜索' },
      }),
    ).toBe('继续搜索');
    expect(
      __testThinkingMessageForStep({
        type: 'custom_step',
        outputData: null,
      }),
    ).toBe('custom_step');
  });
});
