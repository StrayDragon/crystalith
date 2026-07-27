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
      return '等待确认 · 预算将尽，可继续深挖、再扩展或生成结论';
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
