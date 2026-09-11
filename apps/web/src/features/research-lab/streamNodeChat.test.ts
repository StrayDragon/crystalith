import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const streamRequest = rs.hoisted(() => rs.fn());

// Mock reason: deterministic SSE events for streamNodeChat without real fetch.
rs.mock('../../api/stream', () => ({
  streamRequest: (...args: unknown[]) => streamRequest(...args),
}));

import { streamNodeChat } from './edenResearchApi';

describe('streamNodeChat', () => {
  beforeEach(() => {
    streamRequest.mockReset();
  });

  it('POSTs chat path and yields typed chunk/proposal/done', async () => {
    streamRequest.mockImplementation(async function* () {
      yield { event: 'chunk', data: { text: '你好' } };
      yield {
        event: 'proposal',
        data: {
          id: 'p1',
          kind: 'prune_node',
          label: '剪枝',
          rationale: 'r',
          status: 'pending',
        },
      };
      yield { event: 'done', data: { proposals: [] } };
    });

    const events = [];
    for await (const ev of streamNodeChat(62, 9, 'branch_a', { message: '请剪枝' })) {
      events.push(ev);
    }

    expect(streamRequest).toHaveBeenCalledWith(
      '/v2/notebooks/62/research/9/nodes/branch_a/chat',
      expect.objectContaining({
        method: 'POST',
        body: { message: '请剪枝' },
      }),
    );
    expect(events).toEqual([
      { event: 'chunk', data: { text: '你好' } },
      {
        event: 'proposal',
        data: {
          id: 'p1',
          kind: 'prune_node',
          label: '剪枝',
          rationale: 'r',
          status: 'pending',
        },
      },
      { event: 'done', data: { proposals: [] } },
    ]);
  });

  it('yields error events with message', async () => {
    streamRequest.mockImplementation(async function* () {
      yield {
        event: 'error',
        data: { errorCode: 'RESEARCH_INVALID_STATE', message: '节点仍在研究中' },
      };
    });

    const events = [];
    for await (const ev of streamNodeChat(1, 2, 'n', { message: 'x' })) {
      events.push(ev);
    }
    expect(events[0]).toEqual({
      event: 'error',
      data: { errorCode: 'RESEARCH_INVALID_STATE', message: '节点仍在研究中' },
    });
  });
});
