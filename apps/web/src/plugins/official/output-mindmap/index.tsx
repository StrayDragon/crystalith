import { normalizeMindmapNode } from '../../../features/workspace/domains/outputs/mindmapNormalize';
import { MindmapViewer } from '../../../features/workspace/domains/outputs/MindmapViewer';
import { decodeOutputContent } from '../../../features/workspace/shared/outputPayload';
import { FallbackWarning, OutputError } from '../shared';

export function render(content: unknown, isFallback?: boolean) {
  const mindmap = decodeOutputContent('MINDMAP', content);
  if (!mindmap) return <OutputError message="无效的思维导图数据" />;

  const root = normalizeMindmapNode(mindmap.root);
  return (
    <>
      {isFallback ? <FallbackWarning /> : null}
      <MindmapViewer data={{ root }} className="StructuredMindmapInteractive" />
    </>
  );
}
