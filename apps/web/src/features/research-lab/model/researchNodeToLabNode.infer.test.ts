import type { ResearchNode } from '@crystalith/shared';
// covers: r115（deep-research-ui）——role 缺失时按 id 前缀 node_root/node_conclusion 回退推断 question/conclusion。
import { expect, test } from '@rstest/core';

import { researchNodeToLabNode } from '../researchGraphAdapter';

function node(partial: Pick<ResearchNode, 'id'> & Partial<ResearchNode>): ResearchNode {
  return {
    title: `t-${partial.id}`,
    conclusionStatus: 'pending',
    ...partial,
  };
}

test('role 缺失时 node_root 前缀 id 回退推断为 question', () => {
  expect(researchNodeToLabNode(node({ id: 'node_root' })).role).toBe('question');
  expect(researchNodeToLabNode(node({ id: 'node_root_1' })).role).toBe('question');
});

test('role 缺失时 node_conclusion 前缀 id 回退推断为 conclusion', () => {
  expect(researchNodeToLabNode(node({ id: 'node_conclusion' })).role).toBe('conclusion');
  expect(researchNodeToLabNode(node({ id: 'node_conclusion_2' })).role).toBe('conclusion');
});

test('显式 role 优先于 id 前缀启发式', () => {
  expect(researchNodeToLabNode(node({ id: 'node_root', role: 'research' })).role).toBe('research');
  expect(researchNodeToLabNode(node({ id: 'node_conclusion', role: 'question' })).role).toBe(
    'question',
  );
});

test('无已知前缀的 id 回退为 research', () => {
  expect(researchNodeToLabNode(node({ id: 'node_7' })).role).toBe('research');
});
