import MindmapViewer, {
  type MindmapNode,
} from "../../../features/workspace/domains/outputs/MindmapViewer";
import { decodeOutputContent } from "../../../features/workspace/shared/outputPayload";

import { FallbackWarning, OutputError } from "../shared";

function normalizeMindmapNode(node: unknown): MindmapNode {
  const record = node && typeof node === "object" ? (node as Record<string, unknown>) : {};
  const label = typeof record.label === "string" ? record.label : "未命名节点";
  const children = Array.isArray(record.children)
    ? record.children.map((child) => normalizeMindmapNode(child))
    : [];
  return { label, children };
}

export function render(content: unknown, isFallback?: boolean) {
  const mindmap = decodeOutputContent("MINDMAP", content);
  if (!mindmap) return <OutputError message="无效的思维导图数据" />;

  const root = normalizeMindmapNode(mindmap.root);
  return (
    <>
      {isFallback ? <FallbackWarning /> : null}
      <MindmapViewer data={{ root }} className="StructuredMindmapInteractive" />
    </>
  );
}
