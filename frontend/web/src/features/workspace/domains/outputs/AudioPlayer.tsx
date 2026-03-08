interface AudioPlayerProps {
  isBlocked: boolean;
}

const WAVE_BARS = [
  "isShort",
  "isTall",
  "isMedium",
  "isTall",
  "isShort",
  "isMedium",
  "isTall",
  "isShort",
];

export default function AudioPlayer({ isBlocked }: AudioPlayerProps) {
  return (
    <section
      className={`MediaPlayerCard ${isBlocked ? "isBlocked" : ""}`}
      aria-label="音频概述"
      aria-disabled="true"
    >
      <div className="MediaPlayerHeader">
        <div>
          <div className="MediaPlayerTitle">音频概述</div>
          <div className="MediaPlayerSubtitle">AI 主持人播客式对话摘要</div>
        </div>
        <span className="MediaBadge">即将推出</span>
      </div>
      <div className="MediaPlayerBody">
        <div className="MediaWaveform" aria-hidden="true">
          {WAVE_BARS.map((tone, index) => (
            <span key={`${tone}-${index}`} className={`MediaWaveformBar ${tone}`} />
          ))}
        </div>
        <div className="MediaTimeline" aria-hidden="true">
          <div className="MediaTimeline__fill" />
        </div>
        <div className="MediaControls">
          <div className="MediaControlGroup">
            <button type="button" className="MediaControlButton" disabled aria-label="快退 15 秒">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M11 6 4 12l7 6V6Zm9 0-7 6 7 6V6Z" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className="MediaControlButton isPrimary"
              disabled
              aria-label="播放"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M8 5v14l11-7-11-7Z" fill="currentColor" />
              </svg>
            </button>
            <button type="button" className="MediaControlButton" disabled aria-label="快进 15 秒">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M13 6v12l7-6-7-6ZM4 6v12l7-6-7-6Z" fill="currentColor" />
              </svg>
            </button>
          </div>
          <div className="MediaTime">0:00 / 06:30</div>
        </div>
      </div>
      <div className="MediaPlayerFooter">
        <span className="MediaMeta">语言：中文 · 目标时长 5-8 分钟</span>
        <span className="MediaMeta">{isBlocked ? "请先创建笔记本" : "支持多语言与自定义片段"}</span>
      </div>
    </section>
  );
}
