import { describe, expect, it } from '@rstest/core';

import { labComposeDepthBudgetHint } from './labComposeDepth';

// 常量镜像用例（default 值 / OPTIONS 数组逐字复读源码）已删——默认值由
// useEdenLabController.composeDepth 的 create payload 测试间接锁定。
describe('labComposeDepth', () => {
  it('budget hint matches r305 mapping', () => {
    expect(labComposeDepthBudgetHint('shallow')).toBe('浅：约 20 次检索 / 24 节点');
    expect(labComposeDepthBudgetHint('medium')).toBe('中：约 50 次检索 / 60 节点');
    expect(labComposeDepthBudgetHint('deep')).toBe('深：约 100 次检索 / 120 节点');
  });
});
