// isToolRenderable — the generate-entry filter behind r272 (tools contract is
// the availability SSOT). SLIDES disappears while the server reports the
// preview unavailable; every other valid output type renders.
import { describe, expect, it } from '@rstest/core';

import type { WorkspaceTool } from '../../shared/types';
import { isToolRenderable } from './StudioToolsGrid';

function makeTool(overrides: Partial<WorkspaceTool>): WorkspaceTool {
  return {
    id: 'briefing',
    label: '简报',
    description: null,
    tone: 'slate',
    outputType: 'BRIEFING',
    prompt: '',
    enabled: true,
    renderDescriptor: null,
    configSchema: null,
    frontendBundle: null,
    ...overrides,
  } as WorkspaceTool;
}

describe('isToolRenderable', () => {
  it('keeps a normal tool', () => {
    expect(isToolRenderable(makeTool({}))).toBe(true);
  });

  it('keeps SLIDES when available', () => {
    const slides = makeTool({ id: 'slides', outputType: 'SLIDES', enabled: true });
    expect(isToolRenderable(slides)).toBe(true);
  });

  it('drops SLIDES when the preview is unavailable (enabled=false)', () => {
    const slides = makeTool({ id: 'slides', outputType: 'SLIDES', enabled: false });
    expect(isToolRenderable(slides)).toBe(false);
  });

  it('keeps a non-SLIDES tool even when disabled (interaction-disable only)', () => {
    const briefing = makeTool({ enabled: false });
    expect(isToolRenderable(briefing)).toBe(true);
  });

  it('drops unknown output types (generable-set guard)', () => {
    const unknown = makeTool({ outputType: 'PARAGRAPH' as WorkspaceTool['outputType'] });
    expect(isToolRenderable(unknown)).toBe(false);
  });
});
