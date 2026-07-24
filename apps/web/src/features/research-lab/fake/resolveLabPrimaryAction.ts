import type { LabNodeRole, LabPhase } from './types';

export type LabPrimaryActionKind =
  | 'start'
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'finish_report'
  | 'continue_dig'
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
}

export interface LabPrimaryAction {
  kind: LabPrimaryActionKind;
  label: string;
  disabled: boolean;
  title?: string;
  /** Only for awaiting_confirm — ghost secondary next to primary. */
  secondary?: {
    kind: 'continue_dig';
    label: string;
    disabled: boolean;
  };
}

const RUNNING_PHASES = new Set<LabPhase>(['decompose', 'explore', 'evaluate', 'integrate']);

export function resolveLabPrimaryAction(input: LabPrimaryActionInput): LabPrimaryAction {
  const { phase, playing, reshaping, hasTopic, conclusionNodeId, selectedNodeId, selectedRole } =
    input;

  const disableForReshape = (action: LabPrimaryAction): LabPrimaryAction => {
    if (!reshaping) return action;
    return {
      ...action,
      disabled: true,
      title: action.title ?? '流程重塑中，请稍候',
      secondary: action.secondary ? { ...action.secondary, disabled: true } : undefined,
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
    return disableForReshape({
      kind: 'finish_report',
      label: '生成结论',
      disabled: false,
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

  // Fallback (should not hit)
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
