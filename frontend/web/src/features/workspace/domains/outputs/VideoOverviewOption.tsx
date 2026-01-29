export default function VideoOverviewOption() {
  return (
    <div className="VideoOverviewOption">
      <button
        type="button"
        role="tab"
        aria-selected={false}
        aria-disabled="true"
        className="RefineMode isDisabled"
      >
        视频概述
        <span className="RefineModeBadge">即将推出</span>
      </button>
    </div>
  );
}
