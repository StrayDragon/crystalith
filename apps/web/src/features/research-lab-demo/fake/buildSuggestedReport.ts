import type { LabCitation, LabEdge, LabNode } from '../../research-lab/model/types';
import { listFailedMergeTitles, stripFailedMergeNote } from './deriveLabState';

/**
 * Suggested report from the current thinking-graph nodes (product: default model export).
 * Real backend: generateObject / stream from the same node set + citations.
 */
export function buildSuggestedReportFromNodes(input: {
  topic: string;
  nodes: LabNode[];
  citations: Record<string, LabCitation>;
  edges?: LabEdge[];
}): string {
  const { topic, nodes, citations, edges = [] } = input;
  const question = nodes.find((n) => n.role === 'question');
  const research = nodes.filter((n) => n.role === 'research' && n.conclusionStatus !== 'pruned');
  const prunedResearch = nodes.filter(
    (n) => n.role === 'research' && n.conclusionStatus === 'pruned',
  );
  const conclusion = nodes.find((n) => n.role === 'conclusion');
  const conclusionId = conclusion?.id ?? null;
  const failedMerges =
    edges.length > 0
      ? listFailedMergeTitles(nodes, edges, conclusionId)
      : prunedResearch.map((n) => n.title);

  const lines: string[] = [];
  lines.push(`# ${topic}`);
  lines.push('');
  lines.push(
    '> 由当前思考图节点合成的建议报告（Fake 默认导出）。保存新一轮后可与对应图谱成对回看。',
  );
  lines.push('');

  if (question?.conclusion) {
    lines.push('## 研究问题');
    lines.push('');
    lines.push(question.conclusion.trim());
    lines.push('');
  }

  if (research.length) {
    lines.push('## 支路发现');
    lines.push('');
    for (const n of research) {
      const status =
        n.conclusionStatus === 'clear'
          ? '明确'
          : n.conclusionStatus === 'partial'
            ? '待完善'
            : n.conclusionStatus === 'missing'
              ? '无法结论'
              : n.conclusionStatus === 'pending'
                ? '处理中'
                : n.conclusionStatus;
      lines.push(`### ${n.title}（${status}）`);
      lines.push('');
      if (n.query) lines.push(`检索：\`${n.query}\``);
      if (n.query) lines.push('');
      const body = (n.conclusion ?? n.summary ?? '').trim() || '（尚无正文）';
      const citeSuffix = n.citationIds
        .filter((id) => citations[id])
        .map((id) => `[^${id}]`)
        .join('');
      lines.push(`${body}[^@${n.id}]${citeSuffix}`);
      lines.push('');
    }
  }

  lines.push('## 综合结论');
  lines.push('');
  const concl =
    stripFailedMergeNote(conclusion?.conclusion).trim() ||
    '（结论节点尚未生成正文；可继续节点对话定态后再导出。）';
  const conclCites = (conclusion?.citationIds ?? [])
    .filter((id) => citations[id])
    .map((id) => `[^${id}]`)
    .join('');
  const conclNode = conclusion?.id ? `[^@${conclusion.id}]` : '';
  lines.push(`${concl}${conclNode}${conclCites}`);
  lines.push('');

  if (failedMerges.length > 0) {
    lines.push('## 汇入失败支路');
    lines.push('');
    lines.push('以下支路已剪枝：汇入边仍保留在图中，但不参与有效结论。');
    lines.push('');
    for (const title of failedMerges) {
      lines.push(`- ${title}`);
    }
    lines.push('');
  }

  const used = new Set<string>();
  for (const n of nodes) {
    for (const id of n.citationIds) {
      if (citations[id]) used.add(id);
    }
  }
  if (used.size) {
    lines.push('## 引用');
    lines.push('');
    for (const id of used) {
      const c = citations[id]!;
      lines.push(`[^${id}]: ${c.title}${c.url ? ` — ${c.url}` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
