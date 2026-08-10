import type { ResearchConclusionStatus } from '@crystalith/shared';

import type {
  LabNodeActionKind,
  LabNodeActionProposal,
  LabNodeChatTurn,
  ProposeNodeChatTurnInput,
} from './nodeChatTypes';
import { LAB_NODE_ACTION_CATALOG } from './nodeChatTypes';
import type { LabEdge, LabNode } from './types';

function pid(kind: LabNodeActionKind): string {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function proposal(
  kind: LabNodeActionKind,
  label: string,
  rationale: string,
  params?: LabNodeActionProposal['params'],
): LabNodeActionProposal {
  return { id: pid(kind), kind, label, rationale, status: 'pending', params };
}

/** Lightweight intent cues — replace with model tool-calls on real API. */
const REJECT_RE =
  /否定|不要|没用|不对|错误|删掉|删除|剪掉|剪枝|去掉|放弃|reject|prune|useless|wrong|discard/i;
const REWRITE_RE = /改查询|换个|重写|rewrite|换角度|重新检索|query/i;
const FORK_RE = /分叉|对照|另开|再来一条|fork|alternative|对照支路/i;
const FINISH_RE = /结束|出报告|生成报告|收束|finish|done|报告吧/i;
const CONTINUE_RE = /继续|深挖|再挖|continue|dig/i;
const REPORT_RE = /打开报告|看报告|报告页|open.?report/i;
const STATUS_CLEAR_RE = /定为明确|标为明确|确定了|可以定稿|settle|mark\s*clear|设为明确/i;
const STATUS_PARTIAL_RE = /待完善|还不够|标为部分|partial|设为待完善/i;
const STATUS_MISSING_RE = /无法结论|证据不足|missing|无结论|设为无法/i;

function detectStatusIntent(text: string): ResearchConclusionStatus | null {
  if (STATUS_CLEAR_RE.test(text)) return 'clear';
  if (STATUS_PARTIAL_RE.test(text)) return 'partial';
  if (STATUS_MISSING_RE.test(text)) return 'missing';
  return null;
}

const STATUS_LABEL: Record<ResearchConclusionStatus, string> = {
  clear: '明确',
  partial: '待完善',
  missing: '无法结论',
  pending: '处理中',
  pruned: '已剪枝',
};

/**
 * Fake adapter for one node-chat turn.
 * Real backend returns the same `LabNodeChatTurn` shape via SSE/JSON.
 */
export function proposeNodeChatTurn(input: ProposeNodeChatTurnInput): LabNodeChatTurn {
  const { role, title, query, userText, phase, reportAvailable } = input;
  const allowed = new Set(LAB_NODE_ACTION_CATALOG[role]);
  const text = userText.trim();
  const proposals: LabNodeActionProposal[] = [];

  const wantReject = REJECT_RE.test(text);
  const wantRewrite = REWRITE_RE.test(text);
  const wantFork = FORK_RE.test(text);
  const wantFinish = FINISH_RE.test(text);
  const wantContinue = CONTINUE_RE.test(text);
  const wantReport = REPORT_RE.test(text);
  const statusIntent = detectStatusIntent(text);
  const awaiting = phase === 'awaiting_confirm';

  if (wantReject && allowed.has('prune_node')) {
    proposals.push(
      proposal(
        'prune_node',
        '剪枝本支路',
        `将「${title}」标为剪枝并从后续整合中排除（对应 POST …/nodes/:id/prune）。子树预览与边上剪枝相同。`,
      ),
    );
  }

  if ((wantFork || wantReject) && allowed.has('fork_sibling')) {
    proposals.push(
      proposal(
        'fork_sibling',
        '分叉对照支路',
        `从同一父节点另开对照研究（对应 POST …/nodes/:id/fork）。可先填草稿再确认。`,
        {
          title: `对照：${title}`,
          query: query ? `${query} (alt)` : undefined,
          summary: `针对「${title}」的替代探索。`,
        },
      ),
    );
  }

  if (wantRewrite && allowed.has('rewrite_query')) {
    const next =
      role === 'question'
        ? text.replace(REWRITE_RE, '').trim() || `${title}（修订意图）`
        : text.replace(REWRITE_RE, '').trim() || `${query ?? title} · 修订检索`;
    proposals.push(
      proposal(
        'rewrite_query',
        role === 'question' ? '更新研究意图' : '改写检索查询',
        '确认后写入节点并触发 reshape（与 Meta 改查询同一 mutation 口）。',
        { query: next.slice(0, 240) },
      ),
    );
  }

  if (statusIntent && allowed.has('set_status') && statusIntent !== 'pruned') {
    proposals.push(
      proposal(
        'set_status',
        `将状态定为「${STATUS_LABEL[statusIntent]}」`,
        `细节讨论收束后落点（对应 PATCH …/nodes/:id { conclusionStatus }）。当前：${STATUS_LABEL[input.conclusionStatus ?? 'pending']}。`,
        { conclusionStatus: statusIntent },
      ),
    );
  }

  if (awaiting && wantFinish && allowed.has('confirm_finish')) {
    proposals.push(
      proposal('confirm_finish', '结束并出报告', '对应 POST …/confirm { action: finish_report }。'),
    );
  }

  if (awaiting && wantContinue && allowed.has('confirm_continue')) {
    proposals.push(
      proposal('confirm_continue', '继续深挖', '对应 POST …/confirm { action: continue }。'),
    );
  }

  if (wantReport && allowed.has('open_report') && reportAvailable) {
    proposals.push(proposal('open_report', '打开报告页', '导航到独立报告视图（不改图谱）。'));
  }

  const seen = new Set<LabNodeActionKind>();
  const unique = proposals.filter((p) => {
    if (seen.has(p.kind)) return false;
    seen.add(p.kind);
    return true;
  });

  const assistantText = buildAssistantText(input, unique);
  return { assistantText, proposals: unique };
}

function buildAssistantText(
  input: ProposeNodeChatTurnInput,
  proposals: LabNodeActionProposal[],
): string {
  const { role, title, query, userText } = input;
  const q = userText.trim();

  if (proposals.length > 0) {
    const labels = proposals.map((p) => p.label).join(' / ');
    if (proposals.some((p) => p.kind === 'prune_node')) {
      return `听起来你在否定支路「${title}」。正式版会由模型提出 tool 建议；这里已生成待确认指引：${labels}。\n\n请点卡片确认后才会改图——聊天本身不会静默剪枝。`;
    }
    if (proposals.some((p) => p.kind === 'set_status')) {
      return `细节可以收束了。已准备状态变更指引：${labels}。\n\n确认后才会改节点状态；可再「保存新一轮」把图+报告打成快照。`;
    }
    return `已根据你的意图准备操作指引：${labels}。\n\n确认后才会调用与边上分叉/剪枝、confirm API 同一套 mutation；忽略则仅保留对话。`;
  }

  if (role === 'conclusion') {
    return `围绕结论「${title}」：${q}\n\n可试：「定为明确」「打开报告」「结束并出报告」（确认点）。`;
  }
  if (role === 'question') {
    return `已记录对问题的追问：${q}\n\n可试：「改查询 …」「结束」「继续深挖」（在等待确认时）。`;
  }
  return `关于支路「${title}」：${q}\n\n当前查询：${query ?? '（无）'}\n可试：「这条没用」「分叉对照」「改查询 …」「定为明确 / 待完善」。`;
}

/** Inbound edge whose target is this research node — used by prune/fork from chat. */
export function findInboundEdgeForNode(
  nodeId: string,
  edges: LabEdge[],
  nodes: LabNode[],
): LabEdge | null {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || node.role === 'question' || node.role === 'conclusion') return null;
  return edges.find((e) => e.target === nodeId) ?? null;
}
