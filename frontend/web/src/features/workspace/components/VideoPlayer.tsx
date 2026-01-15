interface VideoPlayerProps {
  isBlocked: boolean;
}

export default function VideoPlayer({ isBlocked }: VideoPlayerProps) {
  return (
    <section
      className={`MediaPlayerCard ${isBlocked ? 'isBlocked' : ''}`}
      aria-label="视频概述"
      aria-disabled="true"
    >
      <div className="MediaPlayerHeader">
        <div>
          <div className="MediaPlayerTitle">视频概述</div>
          <div className="MediaPlayerSubtitle">自动生成图文摘要视频</div>
        </div>
        <span className="MediaBadge">即将推出</span>
      </div>
      <div className="MediaPlayerBody">
        <div className="MediaPoster" aria-hidden="true">
          <div className="MediaPosterFrame">
            <div className="MediaPosterGrid" />
            <div className="MediaPosterPlay">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 7v10l8-5-8-5Z" fill="currentColor" />
              </svg>
            </div>
          </div>
          <span className="MediaPosterBadge">16:9</span>
        </div>
        <div className="MediaControls">
          <div className="MediaControlGroup">
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
            <button
              type="button"
              className="MediaControlButton"
              disabled
              aria-label="切换字幕"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm2.5 4.5h3v2h-3v-2Zm5 0h4v2h-4v-2Zm-5 4h7v2h-7v-2Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
          <div className="MediaTime">0:00 / 04:20</div>
        </div>
      </div>
      <div className="MediaPlayerFooter">
        <span className="MediaMeta">分辨率：1080p · 自动字幕</span>
        <span className="MediaMeta">
          {isBlocked ? '请先创建笔记本' : '支持图表抓取与摘要画面'}
        </span>
      </div>
    </section>
  );
}
