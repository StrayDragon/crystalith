export default function AudioOverviewOption() {
  return (
    <div className="AudioOverviewOption">
      <button
        type="button"
        role="tab"
        aria-selected={false}
        aria-disabled="true"
        className="RefineMode isDisabled"
      >
        音频概述
        <span className="RefineModeBadge">即将推出</span>
      </button>
    </div>
  );
}
