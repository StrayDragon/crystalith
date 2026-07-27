import type { LabConfirmKind } from '../research-lab-demo/fake/resolveLabPrimaryAction';
import type { LabPhase } from '../research-lab-demo/fake/types';

/** Top paused/awaiting banner: never pair explore playing with「已暂停」 (r437). */
export function shouldShowLabPausedBanner(input: {
  showCompose: boolean;
  reshaping: boolean;
  playing: boolean;
  phase: LabPhase;
}): boolean {
  const { showCompose, reshaping, playing, phase } = input;
  if (showCompose || reshaping || playing) return false;
  if (phase === 'completed' || phase === 'failed') return false;
  return true;
}

export function labPausedBannerText(phase: LabPhase, confirmKind?: LabConfirmKind | null): string {
  if (phase === 'awaiting_confirm') {
    if (confirmKind === 'expand_branch') {
      return '等待确认 · 提议扩展支路，可批准 / 跳过 / 生成结论';
    }
    if (confirmKind === 'reexpand') {
      return '等待确认 · 再扩展，可批准结构化再拆或跳过并收束';
    }
    if (confirmKind === 'budget') {
      return '等待确认 · 检索预算触顶，可加购继续或生成结论';
    }
    return '等待确认 · 可拖动节点 / 分叉剪枝，或点顶栏收束';
  }
  return '已暂停 · 可拖动节点 / 分叉剪枝，再点顶栏继续';
}

/** Playing tip only while queued/running (playing true) — not awaiting_confirm. */
export function shouldShowLabPlayingTip(input: {
  showCompose: boolean;
  playing: boolean;
}): boolean {
  return !input.showCompose && input.playing;
}

/** Completed with uncovered research nodes after budget finish (c108 / r462). */
export function shouldShowLabPartialCompletionBanner(input: {
  phase: LabPhase;
  nodes: ReadonlyArray<{ role?: string | null; conclusionStatus?: string | null }>;
}): boolean {
  if (input.phase !== 'completed') return false;
  return input.nodes.some((n) => n.role === 'research' && n.conclusionStatus === 'missing');
}

export const LAB_PARTIAL_COMPLETION_BANNER = '预算用尽·部分完成 — 仍有未覆盖的研究支路';
