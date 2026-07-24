import type { LabPhase } from './fake/types';

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

export function labPausedBannerText(phase: LabPhase): string {
  if (phase === 'awaiting_confirm') {
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
