import { describe, expect, it } from '@rstest/core';

import {
  isActiveResearchStatus,
  RESEARCH_QUEUE_POLL_MS,
  researchQueuePollInterval,
} from './researchTaskTypes';
import type { ResearchTaskListItem } from './researchTaskTypes';

// covers: r101
// Desk 队列轮询节流纯函数：存在非终态 Run → 短间隔（5s）；全终态/空队列 → 0
// （关闭轮询）。

const task = (id: string, status: ResearchTaskListItem['status']): ResearchTaskListItem => ({
  id,
  notebookId: 1,
  topic: `topic-${id}`,
  status,
});

describe('r101 research queue poll interval', () => {
  it('polls at the short interval while any run is non-terminal', () => {
    expect(researchQueuePollInterval(1)).toBe(RESEARCH_QUEUE_POLL_MS);
    expect(RESEARCH_QUEUE_POLL_MS).toBe(5_000);
    expect(
      researchQueuePollInterval(
        [task('a', 'running'), task('b', 'completed')].filter((t) =>
          isActiveResearchStatus(t.status),
        ).length,
      ),
    ).toBe(RESEARCH_QUEUE_POLL_MS);
  });

  it('stops polling when every run reached a terminal state', () => {
    const allDone = [task('a', 'completed'), task('b', 'failed'), task('c', 'cancelled')];
    expect(
      researchQueuePollInterval(allDone.filter((t) => isActiveResearchStatus(t.status)).length),
    ).toBe(0);
  });

  it('empty queue and negative input are both off', () => {
    expect(researchQueuePollInterval(0)).toBe(0);
    expect(researchQueuePollInterval(-1)).toBe(0);
  });
});
