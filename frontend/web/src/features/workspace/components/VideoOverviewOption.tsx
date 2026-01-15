import { useEffect, useId, useState } from 'react';

const TOOLTIP_MESSAGE = '此功能正在开发中，敬请期待';

export default function VideoOverviewOption() {
  const tooltipId = useId();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  useEffect(() => {
    if (!isTooltipVisible) return undefined;
    const timeout = window.setTimeout(() => setIsTooltipVisible(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [isTooltipVisible]);

  return (
    <div className="VideoOverviewOption">
      <button
        type="button"
        role="tab"
        aria-selected={false}
        aria-disabled="true"
        aria-describedby={tooltipId}
        className="RefineMode isDisabled"
        onClick={() => setIsTooltipVisible(true)}
        onBlur={() => setIsTooltipVisible(false)}
        title={TOOLTIP_MESSAGE}
      >
        视频概述
        <span className="RefineModeBadge">即将推出</span>
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        aria-hidden={!isTooltipVisible}
        className={`VideoOverviewTooltip ${isTooltipVisible ? 'isVisible' : ''}`}
      >
        {TOOLTIP_MESSAGE}
      </div>
    </div>
  );
}
