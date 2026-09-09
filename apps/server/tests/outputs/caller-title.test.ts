// Caller-supplied display title (tool label) merges into content.title —
// the value the output list/detail renderers show instead of the raw prompt.
import { describe, expect, it } from 'bun:test';

import { applyCallerTitle } from '../../src/features/outputs/pipeline.ts';

describe('applyCallerTitle', () => {
  it('sets content.title when the generated content lacks one', () => {
    const out = applyCallerTitle({ sections: [{ heading: '概述' }] }, '简报');
    expect(out.title).toBe('简报');
    expect(out.sections).toBeDefined();
  });

  it('never clobbers an existing non-empty title', () => {
    const out = applyCallerTitle({ title: '模型起的标题' }, '简报');
    expect(out.title).toBe('模型起的标题');
  });

  it('overwrites a blank existing title', () => {
    expect(applyCallerTitle({ title: '   ' }, '简报').title).toBe('简报');
  });
});
