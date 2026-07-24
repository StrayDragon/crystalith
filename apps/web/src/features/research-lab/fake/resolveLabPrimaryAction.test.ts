import { describe, expect, it } from 'vitest';

import { applyEdenPrimaryActionOverlay, resolveLabPrimaryAction } from './resolveLabPrimaryAction';

const base = {
  playing: false,
  reshaping: false,
  hasTopic: true,
  conclusionNodeId: 'conclusion' as string | null,
  selectedNodeId: null as string | null,
  selectedRole: null as null,
};

describe('resolveLabPrimaryAction', () => {
  it('idle with topic → start', () => {
    const a = resolveLabPrimaryAction({ ...base, phase: 'idle' });
    expect(a).toMatchObject({ kind: 'start', label: '开始深度研究', disabled: false });
  });

  it('idle without topic → start disabled', () => {
    const a = resolveLabPrimaryAction({ ...base, phase: 'idle', hasTopic: false });
    expect(a.disabled).toBe(true);
    expect(a.title).toBeTruthy();
  });

  it('running + playing → pause', () => {
    const a = resolveLabPrimaryAction({
      ...base,
      phase: 'explore',
      playing: true,
    });
    expect(a).toMatchObject({ kind: 'pause', label: '暂停', disabled: false });
  });

  it('running + paused → resume', () => {
    const a = resolveLabPrimaryAction({
      ...base,
      phase: 'evaluate',
      playing: false,
    });
    expect(a).toMatchObject({ kind: 'resume', label: '继续研究' });
  });

  it('awaiting_confirm → finish + secondary continue', () => {
    const a = resolveLabPrimaryAction({ ...base, phase: 'awaiting_confirm' });
    expect(a.kind).toBe('finish_report');
    expect(a.label).toBe('生成结论');
    expect(a.secondary).toEqual({
      kind: 'continue_dig',
      label: '继续深挖',
      disabled: false,
    });
  });

  it('completed without selecting conclusion → view_conclusion', () => {
    const a = resolveLabPrimaryAction({ ...base, phase: 'completed' });
    expect(a).toMatchObject({ kind: 'view_conclusion', label: '查看报告' });
  });

  it('completed with conclusion selected → restart', () => {
    const a = resolveLabPrimaryAction({
      ...base,
      phase: 'completed',
      selectedNodeId: 'conclusion',
      selectedRole: 'conclusion',
    });
    expect(a).toMatchObject({ kind: 'restart', label: '重新研究' });
  });

  it('failed → retry', () => {
    const a = resolveLabPrimaryAction({ ...base, phase: 'failed' });
    expect(a).toMatchObject({ kind: 'retry', label: '重试' });
  });

  it('reshaping disables CTA', () => {
    const a = resolveLabPrimaryAction({
      ...base,
      phase: 'explore',
      playing: true,
      reshaping: true,
    });
    expect(a.disabled).toBe(true);
    expect(a.kind).toBe('pause');
  });
});

describe('applyEdenPrimaryActionOverlay', () => {
  it('maps pause → cancel (取消研究)', () => {
    const a = resolveLabPrimaryAction({
      ...base,
      phase: 'explore',
      playing: true,
    });
    const eden = applyEdenPrimaryActionOverlay(a);
    expect(eden).toMatchObject({ kind: 'cancel', label: '取消研究', disabled: false });
  });

  it('keeps awaiting_confirm finish + continue dig', () => {
    const a = resolveLabPrimaryAction({ ...base, phase: 'awaiting_confirm' });
    const eden = applyEdenPrimaryActionOverlay(a);
    expect(eden.kind).toBe('finish_report');
    expect(eden.label).toBe('生成结论');
    expect(eden.secondary).toEqual({
      kind: 'continue_dig',
      label: '继续深挖',
      disabled: false,
    });
  });

  it('does not remap resume', () => {
    const a = resolveLabPrimaryAction({
      ...base,
      phase: 'evaluate',
      playing: false,
    });
    expect(applyEdenPrimaryActionOverlay(a).kind).toBe('resume');
  });
});
