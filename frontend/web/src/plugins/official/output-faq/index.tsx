import FlashcardViewer from '../../../features/workspace/domains/outputs/FlashcardViewer';
import { decodeOutputContent } from '../../../features/workspace/shared/outputPayload';

import { FallbackWarning, OutputError } from '../shared';

export function render(content: unknown, isFallback?: boolean) {
  const faq = decodeOutputContent('FAQ', content);
  if (!faq) return <OutputError message="无效的闪卡数据" />;

  return (
    <div className="StructuredOutputFaq">
      {isFallback ? <FallbackWarning /> : null}
      <FlashcardViewer items={faq.items} />
    </div>
  );
}
