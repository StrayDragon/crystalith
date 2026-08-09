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

  it('awaiting_confirm budget → finish + continue + reexpand', () => {
    const a = resolveLabPrimaryAction({
      ...base,
      phase: 'awaiting_confirm',
      confirmKind: 'budget',
    });
    expect(a.kind).toBe('finish_report');
    expect(a.label).toBe('生成结论');
    expect(a.confirmHint).toContain('预算');
    expect(a.secondary).toEqual({
      kind: 'continue_dig',
      label: '加购继续',
      disabled: false,
    });
    expect(a.tertiary).toEqual({
      kind: 'request_reexpand',
      label: '再扩展',
      disabled: false,
    });
  });

  it('awaiting_confirm reexpand → approve + skip (no request again)', () => {
    const a = resolveLabPrimaryAction({
      ...base,
      phase: 'awaiting_confirm',
      confirmKind: 'reexpand',
    });
    expect(a.kind).toBe('approve_reexpand');
    expect(a.secondary).toEqual({
      kind: 'skip_reexpand',
      label: '跳过再扩展',
      disabled: false,
    });
    expect(a.tertiary).toBeUndefined();
  });

  it('awaiting_confirm expand_branch → approve + skip + finish', () => {
    const a = resolveLabPrimaryAction({
      ...base,
      phase: 'awaiting_confirm',
      confirmKind: 'expand_branch',
    });
    expect(a.kind).toBe('approve_branch');
    expect(a.secondary).toEqual({
      kind: 'skip_branch',
      label: '跳过支路',
      disabled: false,
    });
    expect(a.tertiary).toEqual({
      kind: 'finish_report',
      label: '生成结论',
      disabled: false,
    });
    expect(a.confirmHint).toContain('扩展');
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

  it('queued + seeded graph → resume schedule (c105 fork)', () => {
    const a = resolveLabPrimaryAction({
      ...base,
      phase: 'decompose',
      playing: true,
    });
    const eden = applyEdenPrimaryActionOverlay(a, {
      runStatus: 'queued',
      hasSeededGraph: true,
    });
    expect(eden).toMatchObject({ kind: 'resume', label: '继续研究', disabled: false });
    expect(eden.secondary).toEqual({
      kind: 'cancel',
      label: '取消研究',
      disabled: false,
    });
  });

  it('queued+seeded overlay stays enabled even if fixture reshaping would disable', () => {
    // Regression: busy MUST NOT be folded into reshaping (manual QA Path C).
    const a = resolveLabPrimaryAction({
      ...base,
      phase: 'decompose',
      playing: true,
      reshaping: false,
    });
    const eden = applyEdenPrimaryActionOverlay(a, {
      runStatus: 'queued',
      hasSeededGraph: true,
    });
    expect(eden.disabled).toBe(false);
    expect(eden.secondary?.disabled).toBe(false);
    expect(eden.kind).toBe('resume');
    expect(eden.secondary?.kind).toBe('cancel');
  });
  it('queued without graph keeps pause→cancel overlay', () => {
    const a = resolveLabPrimaryAction({
      ...base,
      phase: 'decompose',
      playing: true,
    });
    const eden = applyEdenPrimaryActionOverlay(a, {
      runStatus: 'queued',
      hasSeededGraph: false,
    });
    expect(eden.kind).toBe('cancel');
  });

  it('keeps expand_branch approve + skip', () => {
    const a = resolveLabPrimaryAction({
      ...base,
      phase: 'awaiting_confirm',
      confirmKind: 'expand_branch',
    });
    const eden = applyEdenPrimaryActionOverlay(a);
    expect(eden.kind).toBe('approve_branch');
    expect(eden.secondary?.kind).toBe('skip_branch');
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
