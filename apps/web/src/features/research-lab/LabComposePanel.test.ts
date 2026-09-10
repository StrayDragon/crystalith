import { describe, expect, it } from '@rstest/core';

import { labComposeDescription, labComposeExampleLabel, labComposeHint } from './LabComposePanel';

describe('LabComposePanel copy by mode', () => {
  it('eden description/hint avoid fixture and xlsx authority', () => {
    const description = labComposeDescription('eden');
    const hint = labComposeHint('eden');
    const example = labComposeExampleLabel('eden');

    expect(description).toMatchInlineSnapshot(
      `"填写主题与检索通道后开始。将创建真实 ResearchRun，并进入研究图与实时进度。"`,
    );
    expect(hint).toMatchInlineSnapshot(`"创建后进入研究图与 SSE 进度。"`);
    expect(example).toMatchInlineSnapshot(`"填入示例主题"`);

    expect(description.toLowerCase()).not.toContain('fixture');
    expect(description).not.toContain('xlsx');
    expect(description).not.toContain('演示回放');
    expect(description).not.toContain('接线后');
    expect(hint.toLowerCase()).not.toContain('fixture');
    expect(hint).not.toContain('xlsx');
    expect(example).not.toContain('xlsx');
  });

  it('fixture keeps demo / xlsx copy', () => {
    const description = labComposeDescription('fixture');
    const hint = labComposeHint('fixture');
    const example = labComposeExampleLabel('fixture');

    expect(description).toMatchInlineSnapshot(
      `"填写主题与检索通道后开始。当前为演示回放（xlsx 选型 fixture）；接线后将创建真实 ResearchRun。"`,
    );
    expect(hint).toMatchInlineSnapshot(
      `"演示：开始后将进入研究图回放；正式环境将创建 ResearchRun 任务。"`,
    );
    expect(example).toMatchInlineSnapshot(`"填入示例主题（xlsx 选型）"`);

    expect(description).toContain('演示回放');
    expect(description).toContain('xlsx');
    expect(example).toContain('xlsx');
  });
});
