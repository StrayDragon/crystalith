import ReportViewer from '../../../features/workspace/domains/outputs/ReportViewer';
import { decodeOutputContent } from '../../../features/workspace/shared/outputPayload';

import { FallbackWarning, OutputError } from '../shared';

export function render(content: unknown, isFallback?: boolean) {
  const briefing = decodeOutputContent('BRIEFING', content);
  if (!briefing) return <OutputError message="无效的报告数据" />;

  return (
    <div className="StructuredOutputBriefing">
      {isFallback ? <FallbackWarning /> : null}
      <ReportViewer sections={briefing.sections} />
    </div>
  );
}
