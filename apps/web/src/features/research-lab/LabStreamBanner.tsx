/**
 * Run SSE interruption banner (c64 / r13): visible "reconnecting" state while
 * the bounded-reconnect loop is retrying, and an explicit "reconnect failed"
 * state with a manual retry entry once attempts are exhausted.
 */
import { STREAM_RECONNECT_MAX_ATTEMPTS } from '../../api/stream';
import type { StreamReconnectState } from '../../api/stream';
import { useLayer } from '../../shared/layer';
import { TestIds, tid } from '../../shared/testids';

interface LabStreamBannerProps {
  streamState: StreamReconnectState;
  streamAttempt: number;
  retryStream: () => void;
}

export function LabStreamBanner({ streamState, streamAttempt, retryStream }: LabStreamBannerProps) {
  // Layer system (not Tailwind z-*) per design §4 — same visual band as the
  // existing top-center lab banners.
  const { style } = useLayer('popover');
  if (streamState === 'ok') return null;

  if (streamState === 'reconnecting') {
    return (
      <div
        className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1.5 text-[11px] font-medium text-amber-900 shadow-md backdrop-blur"
        style={style}
        {...tid(TestIds.researchLabStreamReconnecting)}
      >
        连接中断，正在重连（{streamAttempt}/{STREAM_RECONNECT_MAX_ATTEMPTS}）…
      </div>
    );
  }

  return (
    <div
      className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-full border border-red-200 bg-red-50/95 px-3 py-1.5 text-[11px] font-medium text-red-900 shadow-md backdrop-blur"
      style={style}
      {...tid(TestIds.researchLabStreamExhausted)}
    >
      <span>连接已断开，自动重连未成功</span>
      <button
        type="button"
        className="rounded-full border border-red-300 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-red-900 hover:bg-red-100"
        onClick={retryStream}
        {...tid(TestIds.researchLabStreamRetry)}
      >
        重试
      </button>
    </div>
  );
}
