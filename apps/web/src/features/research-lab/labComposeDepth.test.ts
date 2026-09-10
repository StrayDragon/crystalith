import { describe, expect, it } from '@rstest/core';

import {
  DEFAULT_LAB_COMPOSE_DEPTH,
  labComposeDepthBudgetHint,
  LAB_COMPOSE_DEPTH_OPTIONS,
} from './labComposeDepth';

describe('labComposeDepth', () => {
  it('defaults to medium', () => {
    expect(DEFAULT_LAB_COMPOSE_DEPTH).toBe('medium');
  });

  it('exposes three tiers', () => {
    expect(LAB_COMPOSE_DEPTH_OPTIONS.map((o) => o.value)).toEqual(['shallow', 'medium', 'deep']);
  });

  it('budget hint matches r305 mapping', () => {
    expect(labComposeDepthBudgetHint('shallow')).toBe('浅：约 20 次检索 / 24 节点');
    expect(labComposeDepthBudgetHint('medium')).toBe('中：约 50 次检索 / 60 节点');
    expect(labComposeDepthBudgetHint('deep')).toBe('深：约 100 次检索 / 120 节点');
  });
});
