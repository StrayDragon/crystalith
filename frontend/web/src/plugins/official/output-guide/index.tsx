import GuideChecklist from '../../../features/workspace/domains/outputs/GuideChecklist';
import { decodeOutputContent } from '../../../features/workspace/shared/outputPayload';

import { FallbackWarning, OutputError } from '../shared';

export function render(content: unknown, isFallback?: boolean) {
  const guide = decodeOutputContent('GUIDE', content);
  if (!guide) return <OutputError message="无效的指南数据" />;

  return (
    <div className="StructuredOutputGuide">
      {isFallback ? <FallbackWarning /> : null}
      <GuideChecklist modules={guide.modules} />
    </div>
  );
}
