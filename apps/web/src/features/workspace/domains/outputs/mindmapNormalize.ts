import type { MindmapNode } from './MindmapViewer';

/** Normalize raw content to MindmapViewer-compatible nodes (SSOT). */
export function normalizeMindmapNode(node: unknown): MindmapNode {
  if (!node || typeof node !== 'object') {
    return { label: typeof node === 'string' ? node : '未命名节点' };
  }
  const record = node as Record<string, unknown>;
  const label = typeof record.label === 'string' ? record.label : '未命名节点';
  const children = Array.isArray(record.children)
    ? record.children.map((child) => normalizeMindmapNode(child))
    : undefined;
  return { label, children };
}
