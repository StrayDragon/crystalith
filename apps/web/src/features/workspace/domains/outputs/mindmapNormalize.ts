import type { MindmapNode } from './MindmapViewer';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Normalize raw content to MindmapViewer-compatible nodes (SSOT). */
export function normalizeMindmapNode(node: unknown): MindmapNode {
  if (!isRecord(node)) {
    return { label: typeof node === 'string' ? node : '未命名节点' };
  }
  const label = typeof node.label === 'string' ? node.label : '未命名节点';
  const children = Array.isArray(node.children)
    ? node.children.map((child) => normalizeMindmapNode(child))
    : undefined;
  return { label, children };
}
