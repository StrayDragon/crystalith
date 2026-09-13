import { expect, test } from '@rstest/core';

import { stripLeakedToolCallXml } from './stripLeakedToolCallXml';

test('removes closed tool_call xml and keeps surrounding answer', () => {
  const leaked = [
    'Hi! 👋',
    '',
    '<tool_call> <function=retrieveSources> <parameter=query> 战网 lutris 配置 安装 </tool_call> [1]',
    '',
    '战网怎么在 lutris 配置？',
  ].join('\n');

  expect(stripLeakedToolCallXml(leaked)).toBe('Hi! 👋\n\n[1]\n\n战网怎么在 lutris 配置？');
});

test('drops an unclosed tool_call tail (mid-stream)', () => {
  expect(stripLeakedToolCallXml('前文\n<tool_call> <function=retrieveSources>')).toBe('前文');
});

test('leaves ordinary markdown untouched', () => {
  const md = '用 **Lutris** 安装即可。';
  expect(stripLeakedToolCallXml(md)).toBe(md);
});
