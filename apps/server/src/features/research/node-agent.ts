/**
 * ResearchNodeAgent — single ToolLoopAgent for node work_unit / node_chat (§7.4 A).
 *
 * Structure tools never auto-mutate the graph: in `node_chat` they require
 * `toolApproval: user-approval`. The chat SSE maps approval requests →
 * ActionProposal events; FE accept goes through prune/fork/PATCH/confirm ports.
 */
import type {
  ResearchNode,
  ResearchNodeActionProposal,
  ResearchNodeRole,
} from '@crystalith/shared';
import { isStepCount, tool, ToolLoopAgent } from 'ai';
import { z } from 'zod';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { fetchPageTool } from '../../ai/tools/fetch-page.ts';
import { retrieveSourcesTool } from '../../ai/tools/retrieve-sources.ts';
import { webSearchTool } from '../../ai/tools/web-search.ts';
import { db } from '../../db/index.ts';
import { embedSingle } from '../../rag/embedder.ts';
import { getDefaultChatModel, getSearxngHost, getWorkUnitMaxSteps } from '../../shared/config.ts';
import { withRunLlmLockReleased } from './run-locks.ts';

/** Release per-run LLM lock while tool IO runs so parallel work-units can overlap search. */
function wrapToolIoOutsideLlmLock<T extends { execute?: (...args: never[]) => unknown }>(t: T): T {
  const execute = t.execute;
  if (typeof execute !== 'function') return t;
  return {
    ...t,
    execute: async (...args: never[]) =>
      withRunLlmLockReleased(() => execute(...args) as ReturnType<typeof execute>),
  };
}
export type ResearchAgentMode = 'work_unit' | 'node_chat';

export const ResearchNodeAgentCallOptionsSchema = z.object({
  mode: z.enum(['work_unit', 'node_chat']),
  role: z.enum(['question', 'research', 'conclusion']),
  nodeId: z.string().min(1),
  nodeTitle: z.string(),
  nodeQuery: z.string().optional(),
  allowWeb: z.boolean().default(false),
  useNotebookSources: z.boolean().default(false),
  /** Remaining successful page fetches for the Run (c107). */
  pagesRemaining: z.number().int().nonnegative().optional(),
  /** Per-node soft page cap for this work-unit (c107). */
  pageSoft: z.number().int().positive().optional(),
  /** Remaining web searches for the Run. */
  searchesRemaining: z.number().int().nonnegative().optional(),
  /** Per-node soft search cap for this work-unit (c108). */
  searchSoft: z.number().int().positive().optional(),
});
export type ResearchNodeAgentCallOptions = z.infer<typeof ResearchNodeAgentCallOptionsSchema>;

const STRUCTURE_TOOL_NAMES = [
  'propose_prune',
  'propose_fork',
  'propose_rewrite_query',
  'propose_set_status',
  'propose_confirm_finish',
  'propose_confirm_continue',
  'propose_open_report',
] as const;

type StructureToolName = (typeof STRUCTURE_TOOL_NAMES)[number];

const STRUCTURE_TO_KIND: Record<StructureToolName, ResearchNodeActionProposal['kind']> = {
  propose_prune: 'prune_node',
  propose_fork: 'fork_sibling',
  propose_rewrite_query: 'rewrite_query',
  propose_set_status: 'set_status',
  propose_confirm_finish: 'confirm_finish',
  propose_confirm_continue: 'confirm_continue',
  propose_open_report: 'open_report',
};

const STRUCTURE_LABEL: Record<StructureToolName, string> = {
  propose_prune: '剪枝此节点',
  propose_fork: '分叉兄弟节点',
  propose_rewrite_query: '改写查询',
  propose_set_status: '设置结论状态',
  propose_confirm_finish: '结束并出报告',
  propose_confirm_continue: '加购并继续研究',
  propose_open_report: '打开报告',
};

function isStructureToolName(name: string): name is StructureToolName {
  return (STRUCTURE_TOOL_NAMES as readonly string[]).includes(name);
}

/** Map a Structure tool call (or approval) into a Desk ActionProposal. */
export function proposalFromStructureToolCall(input: {
  toolName: string;
  toolCallId?: string;
  args?: unknown;
}): ResearchNodeActionProposal | null {
  if (!isStructureToolName(input.toolName)) return null;
  const args =
    input.args && typeof input.args === 'object' && !Array.isArray(input.args)
      ? (input.args as Record<string, unknown>)
      : {};
  const params: ResearchNodeActionProposal['params'] = {};
  if (typeof args.query === 'string') params.query = args.query;
  if (typeof args.title === 'string') params.title = args.title;
  if (typeof args.summary === 'string') params.summary = args.summary;
  if (typeof args.conclusionStatus === 'string') {
    const allowed = ['clear', 'partial', 'missing', 'pending', 'pruned'] as const;
    if ((allowed as readonly string[]).includes(args.conclusionStatus)) {
      params.conclusionStatus = args.conclusionStatus as NonNullable<
        ResearchNodeActionProposal['params']
      >['conclusionStatus'];
    }
  }
  return {
    id: input.toolCallId ?? `ap_${input.toolName}`,
    kind: STRUCTURE_TO_KIND[input.toolName],
    label: STRUCTURE_LABEL[input.toolName],
    rationale:
      typeof args.rationale === 'string'
        ? args.rationale
        : '接受后走命令口执行（chat 不会自动改图）',
    status: 'pending',
    params: Object.keys(params).length ? params : undefined,
  };
}

function structureTools() {
  const rationale = z.string().optional().describe('向用户说明为何建议该动作');
  return {
    propose_prune: tool({
      description: '提议剪枝当前研究节点（须用户确认；不会自动改图）',
      inputSchema: z.object({ rationale }),
      // execute exists for type completeness; toolApproval blocks it in node_chat
      execute: async () => ({ ok: false, reason: 'requires_user_confirm' }),
    }),
    propose_fork: tool({
      description: '提议从当前节点分叉兄弟研究（须用户确认）',
      inputSchema: z.object({
        rationale,
        title: z.string().optional(),
        query: z.string().optional(),
      }),
      execute: async () => ({ ok: false, reason: 'requires_user_confirm' }),
    }),
    propose_rewrite_query: tool({
      description: '提议改写节点 query/title（须用户确认后 PATCH）',
      inputSchema: z.object({
        rationale,
        query: z.string().min(1),
        title: z.string().optional(),
      }),
      execute: async () => ({ ok: false, reason: 'requires_user_confirm' }),
    }),
    propose_set_status: tool({
      description: '提议设置节点 conclusionStatus（须用户确认后 PATCH）',
      inputSchema: z.object({
        rationale,
        conclusionStatus: z.enum(['clear', 'partial', 'missing', 'pending']),
      }),
      execute: async () => ({ ok: false, reason: 'requires_user_confirm' }),
    }),
    propose_confirm_finish: tool({
      description: '提议结束研究并生成报告（须用户确认）',
      inputSchema: z.object({ rationale }),
      execute: async () => ({ ok: false, reason: 'requires_user_confirm' }),
    }),
    propose_confirm_continue: tool({
      description:
        '提议加购检索预算并继续研究（须用户确认；接受后走 add-budget 或 budget continue）',
      inputSchema: z.object({ rationale }),
      execute: async () => ({ ok: false, reason: 'requires_user_confirm' }),
    }),
    propose_open_report: tool({
      description: '提议打开报告视图（纯前端；可无需后端）',
      inputSchema: z.object({ rationale }),
      execute: async () => ({ ok: false, reason: 'requires_user_confirm' }),
    }),
  };
}

function workTools(opts: { notebookId: number; allowWeb: boolean; useNotebookSources: boolean }) {
  return {
    webSearch: opts.allowWeb
      ? wrapToolIoOutsideLlmLock(webSearchTool({ host: getSearxngHost() || '' }))
      : wrapToolIoOutsideLlmLock(webSearchTool({ host: '' })),
    ...(opts.allowWeb ? { fetchPage: wrapToolIoOutsideLlmLock(fetchPageTool()) } : {}),
    retrieveSources: wrapToolIoOutsideLlmLock(
      retrieveSourcesTool(db(), opts.notebookId, embedSingle),
    ),
  };
}

function chatInstructions(
  role: ResearchNodeRole,
  node: Pick<ResearchNode, 'title' | 'query'>,
): string {
  return [
    '你是 Deep Research 节点助手。用简洁中文回复。',
    `当前节点角色：${role}；标题：${node.title}`,
    node.query ? `当前 query：${node.query}` : '',
    '可用 Work 工具做检索（webSearch / fetchPage / retrieveSources）。',
    'webSearch 得 SERP 摘要后，对值得读的 URL 自选调用 fetchPage 读正文；禁止编造。',
    '改图类动作必须调用 Structure 提议工具（propose_*），不要声称已剪枝/分叉。',
    '用户接受提议后由前端走 HTTP 命令口；你不会直接改图。',
  ]
    .filter(Boolean)
    .join('\n');
}

function workInstructions(options: ResearchNodeAgentCallOptions): string {
  const budgetBits = [
    typeof options.searchesRemaining === 'number' ? `剩余搜索 ${options.searchesRemaining}` : null,
    typeof options.searchSoft === 'number' ? `本节点搜索软上限 ${options.searchSoft}` : null,
    typeof options.pagesRemaining === 'number' ? `剩余读页 ${options.pagesRemaining}` : null,
    typeof options.pageSoft === 'number' ? `本节点读页软上限 ${options.pageSoft}` : null,
  ].filter(Boolean);
  return [
    '你在执行研究节点工作单元：检索并综合证据。',
    `节点角色：${options.role}`,
    '只使用 Work 工具；不要调用 propose_* 结构工具。',
    '流程：webSearch → 自选值得读的 URL 调用 fetchPage → 基于正文薄判断是否够用 → 不够可再搜/再读。',
    '禁止编造来源；无命中时保持空列表。',
    budgetBits.length ? `预算：${budgetBits.join('；')}。` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function createResearchNodeAgent(notebookId: number) {
  const modelConfig = getDefaultChatModel();
  if (!modelConfig) return null;
  const model = withRetry(await resolveModel(modelConfig));
  const structure = structureTools();
  const baseWork = workTools({
    notebookId,
    allowWeb: true,
    useNotebookSources: true,
  });

  // AI SDK ToolLoopAgent tool generics are brittle across prepareCall tool bags;
  // validate behavior via tests rather than fighting the inference graph here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings: any = {
    id: 'research-node-agent',
    model,
    callOptionsSchema: ResearchNodeAgentCallOptionsSchema,
    tools: {
      ...structure,
      ...baseWork,
    },
    prepareCall: (callArgs: { options: ResearchNodeAgentCallOptions; [key: string]: unknown }) => {
      const options = callArgs.options;
      const { options: _opts, ...rest } = callArgs;
      const work = workTools({
        notebookId,
        allowWeb: options.allowWeb,
        useNotebookSources: options.useNotebookSources,
      });
      const tools = {
        ...structure,
        ...work,
      };
      const workActive = [
        ...(options.allowWeb ? (['webSearch', 'fetchPage'] as const) : []),
        ...(options.useNotebookSources ? (['retrieveSources'] as const) : []),
      ];
      if (options.mode === 'work_unit') {
        return {
          ...rest,
          tools,
          instructions: workInstructions(options),
          activeTools: workActive,
          toolApproval: undefined,
          stopWhen: isStepCount(getWorkUnitMaxSteps()),
        };
      }
      const structureActive = STRUCTURE_TOOL_NAMES.filter((name) => {
        if (options.role === 'research') {
          return (
            name === 'propose_prune' ||
            name === 'propose_fork' ||
            name === 'propose_rewrite_query' ||
            name === 'propose_set_status'
          );
        }
        if (options.role === 'question') {
          return (
            name === 'propose_rewrite_query' ||
            name === 'propose_confirm_finish' ||
            name === 'propose_confirm_continue'
          );
        }
        return (
          name === 'propose_open_report' ||
          name === 'propose_confirm_finish' ||
          name === 'propose_set_status'
        );
      });
      return {
        ...rest,
        tools,
        instructions: chatInstructions(options.role, {
          title: options.nodeTitle,
          query: options.nodeQuery,
        }),
        activeTools: [...workActive, ...structureActive],
        toolApproval: Object.fromEntries(
          STRUCTURE_TOOL_NAMES.map((name) => [name, 'user-approval' as const]),
        ),
        stopWhen: isStepCount(8),
      };
    },
  };

  return new ToolLoopAgent(settings);
}
