import type { LabNodeRole, LabPhase } from './types';

export type LabConfirmKind = 'budget' | 'expand_branch';

export type LabPrimaryActionKind =
  | 'start'
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'finish_report'
  | 'continue_dig'
  | 'approve_branch'
  | 'skip_branch'
  | 'view_conclusion'
  | 'restart'
  | 'retry';

export interface LabPrimaryActionInput {
  phase: LabPhase;
  playing: boolean;
  reshaping: boolean;
  /** Non-empty question / topic text. */
  hasTopic: boolean;
  conclusionNodeId: string | null;
  selectedNodeId: string | null;
  selectedRole: LabNodeRole | null;
  /** M1 confirm differentiation (c96). */
  confirmKind?: LabConfirmKind | null;
}

export type LabPrimaryActionSlot = {
  kind: LabPrimaryActionKind;
  label: string;
  disabled: boolean;
};

export interface LabPrimaryAction {
  kind: LabPrimaryActionKind;
  label: string;
  disabled: boolean;
  title?: string;
  /** Confirm-kind hint for banner / a11y. */
  confirmHint?: string;
  /** Ghost secondary next to primary. */
  secondary?: LabPrimaryActionSlot;
  /** Third button (expand_branch → finish_report). */
  tertiary?: LabPrimaryActionSlot;
}

const RUNNING_PHASES = new Set<LabPhase>(['decompose', 'explore', 'evaluate', 'integrate']);

export function resolveLabPrimaryAction(input: LabPrimaryActionInput): LabPrimaryAction {
  const {
    phase,
    playing,
    reshaping,
    hasTopic,
    conclusionNodeId,
    selectedNodeId,
    selectedRole,
    confirmKind,
  } = input;

  const disableForReshape = (action: LabPrimaryAction): LabPrimaryAction => {
    if (!reshaping) return action;
    return {
      ...action,
      disabled: true,
      title: action.title ?? '流程重塑中，请稍候',
      secondary: action.secondary ? { ...action.secondary, disabled: true } : undefined,
      tertiary: action.tertiary ? { ...action.tertiary, disabled: true } : undefined,
    };
  };

  if (phase === 'idle') {
    return disableForReshape({
      kind: 'start',
      label: '开始深度研究',
      disabled: !hasTopic,
      title: hasTopic ? undefined : '请先填写研究主题',
    });
  }

  if (phase === 'awaiting_confirm') {
    if (confirmKind === 'expand_branch') {
      return disableForReshape({
        kind: 'approve_branch',
        label: '批准扩支',
        disabled: false,
        confirmHint: '提议扩展支路 · 可批准、跳过或直接生成结论',
        title: '批准提议的研究支路',
        secondary: {
          kind: 'skip_branch',
          label: '跳过支路',
          disabled: false,
        },
        tertiary: {
          kind: 'finish_report',
          label: '生成结论',
          disabled: false,
        },
      });
    }
    // Default / budget (H3=A): only continue + finish_report
    return disableForReshape({
      kind: 'finish_report',
      label: '生成结论',
      disabled: false,
      confirmHint: '预算将尽 · 可继续深挖或生成结论',
      title: '结束并生成研究报告',
      secondary: {
        kind: 'continue_dig',
        label: '继续深挖',
        disabled: false,
      },
    });
  }

  if (phase === 'failed') {
    return disableForReshape({
      kind: 'retry',
      label: '重试',
      disabled: false,
    });
  }

  if (phase === 'completed') {
    const conclusionSelected =
      selectedRole === 'conclusion' ||
      (conclusionNodeId !== null && selectedNodeId === conclusionNodeId);
    if (conclusionSelected) {
      return disableForReshape({
        kind: 'restart',
        label: '重新研究',
        disabled: false,
      });
    }
    return disableForReshape({
      kind: 'view_conclusion',
      label: '查看报告',
      disabled: conclusionNodeId === null,
      title: conclusionNodeId === null ? '尚无结论节点' : undefined,
    });
  }

  if (RUNNING_PHASES.has(phase)) {
    if (playing) {
      return disableForReshape({
        kind: 'pause',
        label: '暂停',
        disabled: false,
      });
    }
    return disableForReshape({
      kind: 'resume',
      label: '继续研究',
      disabled: false,
    });
  }

  return disableForReshape({
    kind: 'start',
    label: '开始深度研究',
    disabled: !hasTopic,
  });
}

/** Eden overlay: queued/running primary maps to cancel, not fixture pause. */
export function applyEdenPrimaryActionOverlay(action: LabPrimaryAction): LabPrimaryAction {
  if (action.kind === 'pause') {
    return {
      ...action,
      kind: 'cancel',
      label: '取消研究',
    };
  }
  return action;
}
