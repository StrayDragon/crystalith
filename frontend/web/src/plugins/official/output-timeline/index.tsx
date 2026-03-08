import TimelineViewer from "../../../features/workspace/domains/outputs/TimelineViewer";
import { decodeOutputContent } from "../../../features/workspace/shared/outputPayload";

import { FallbackWarning, OutputError } from "../shared";

export function render(content: unknown, isFallback?: boolean) {
  const timeline = decodeOutputContent("TIMELINE", content);
  if (!timeline) return <OutputError message="无效的时间轴数据" />;

  return (
    <div className="StructuredOutputTimeline">
      {isFallback ? <FallbackWarning /> : null}
      <TimelineViewer events={timeline.events} />
    </div>
  );
}
