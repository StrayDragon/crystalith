import { useEffect, useRef, useState } from 'react';

import { TestIds, tid } from '../../shared/testids';
import { resolveNodeCitations } from './evidenceAdapter';
import type { LabNodeActionProposal } from './fake/nodeChatTypes';
import {
  buildNodeQuickActionGroups,
  QUICK_ACTION_ACTIVE_CLASS,
  QUICK_ACTION_TONE_CLASS,
} from './fake/nodeQuickActions';
import { proposeNodeChatTurn } from './fake/proposeNodeChatTurn';
import {
  resolveDefaultNodePanelTab,
  type LabNodePanelTab,
} from './fake/resolveDefaultNodePanelTab';
import type { LabCitation, LabNode, LabPhase } from './fake/types';
import { LAB_STATUS_LEGEND } from './LabGraph';

type ChatRole = 'user' | 'assistant' | 'system';

interface NodeChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  streaming?: boolean;
  proposals?: LabNodeActionProposal[];
}

/** Per-node chat histories survive switching selection within the session. */
const chatByNodeId = new Map<string, NodeChatMessage[]>();

function seedMessages(node: LabNode): NodeChatMessage[] {
  const roleHint =
    node.role === 'question'
      ? '提问节点会话。可改意图、在确认点收束；试「改查询 …」「结束」「继续深挖」。'
      : node.role === 'conclusion'
        ? '结论节点会话。可追问综述；试「打开报告」「结束并出报告」。'
        : '研究支路会话。否定/改写/定态会弹出待确认指引——确认后才改图。试「定为明确」。';
  return [
    {
      id: `${node.id}-sys`,
      role: 'system',
      text: roleHint,
    },
  ];
}

async function streamInto(
  full: string,
  onUpdate: (partial: string, done: boolean) => void,
): Promise<void> {
  const chars = [...full];
  let acc = '';
  for (let i = 0; i < chars.length; i++) {
    acc += chars[i];
    onUpdate(acc, false);
    await new Promise((r) => setTimeout(r, chars[i] === '\n' ? 18 : 8));
  }
  onUpdate(acc, true);
}

export default function LabNodeDrawer({
  node,
  citations,
  phase,
  onClose,
  onEdit,
  overlay,
  reportAvailable,
  onOpenReport,
  constraintsNote,
  onConfirmFinish,
  onConfirmContinue,
  onAcceptAction,
}: {
  node: LabNode | null;
  citations: Record<string, LabCitation>;
  phase: LabPhase;
  onClose: () => void;
  onEdit?: (nodeId: string, patch: Partial<LabNode>) => void;
  overlay?: boolean;
  reportAvailable?: boolean;
  onOpenReport?: () => void;
  constraintsNote?: string | null;
  onConfirmFinish?: () => void;
  onConfirmContinue?: () => void;
  /**
   * Apply a confirmed ActionProposal via the same mutation ports as edge dialogs / confirm API.
   * Return false if the host could not apply (e.g. missing inbound edge).
   */
  onAcceptAction?: (proposal: LabNodeActionProposal, node: LabNode) => boolean | void;
}) {
  const [tab, setTab] = useState<LabNodePanelTab>('meta');
  const [messages, setMessages] = useState<NodeChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!node) return;
    nodeIdRef.current = node.id;
    const existing = chatByNodeId.get(node.id);
    setMessages(existing ?? seedMessages(node));
    // Only re-pick default tab on selection change — not when status updates live.
    setTab(resolveDefaultNodePanelTab(node));
    setInput('');
    setStreaming(false);
  }, [node?.id]);

  useEffect(() => {
    if (!node) return;
    chatByNodeId.set(node.id, messages);
  }, [node, messages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  if (!node) return null;

  const style = LAB_STATUS_LEGEND[node.conclusionStatus];
  const cites =
    node.citationIds.length === 0 ? [] : resolveNodeCitations(node.citationIds, citations);
  const isConclusion = node.role === 'conclusion';
  const isQuestion = node.role === 'question';
  const showConfirm =
    phase === 'awaiting_confirm' && (isQuestion || isConclusion) && onConfirmFinish;

  const patchProposal = (
    messageId: string,
    proposalId: string,
    status: LabNodeActionProposal['status'],
  ) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.proposals) return m;
        return {
          ...m,
          proposals: m.proposals.map((p) => (p.id === proposalId ? { ...p, status } : p)),
        };
      }),
    );
  };

  const runAction = (proposal: LabNodeActionProposal, via: 'chat' | 'badge'): boolean => {
    let next = proposal;
    if (proposal.kind === 'rewrite_query') {
      const seed = proposal.params?.query ?? node.query ?? node.conclusion ?? '';
      const typed = window.prompt(node.role === 'question' ? '研究意图 / 问题' : '检索查询', seed);
      if (typed === null) return false;
      const q = typed.trim();
      if (!q) return false;
      next = { ...proposal, params: { ...proposal.params, query: q } };
    }
    if (proposal.kind === 'prune_node') {
      if (!window.confirm(`确认剪枝「${node.title}」？`)) return false;
    }
    const ok = onAcceptAction?.(next, node);
    const failed = ok === false;
    setMessages((prev) => [
      ...prev,
      {
        id: `${node.id}-sys-${Date.now()}`,
        role: 'system',
        text: failed
          ? `无法执行「${next.label}」：缺少可用边或当前节点不允许该动作。`
          : via === 'badge'
            ? `已通过快捷配置执行「${next.label}」。`
            : `已执行「${next.label}」。`,
      },
    ]);
    return !failed;
  };

  const quickGroups = buildNodeQuickActionGroups({
    node,
    phase,
    reportAvailable,
  });

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    const userMsg: NodeChatMessage = {
      id: `${node.id}-u-${Date.now()}`,
      role: 'user',
      text,
    };
    const asstId = `${node.id}-a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: asstId, role: 'assistant', text: '', streaming: true },
    ]);
    setStreaming(true);

    const turn = proposeNodeChatTurn({
      nodeId: node.id,
      role: node.role ?? 'research',
      title: node.title,
      query: node.query,
      userText: text,
      phase,
      reportAvailable,
      conclusionStatus: node.conclusionStatus,
    });

    await streamInto(turn.assistantText, (partial, done) => {
      if (nodeIdRef.current !== node.id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? {
                ...m,
                text: partial,
                streaming: !done,
                proposals: done ? turn.proposals : m.proposals,
              }
            : m,
        ),
      );
      if (done) setStreaming(false);
    });
  };

  return (
    <aside
      className={
        overlay
          ? 'absolute top-3 right-3 bottom-3 z-10 flex w-[min(380px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white/95 shadow-xl backdrop-blur'
          : 'flex w-[380px] shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white'
      }
      {...tid(TestIds.researchLabNodeDrawer)}
    >
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-gray-400">
            {isConclusion ? '结论会话' : isQuestion ? '提问会话' : '研究会话'}
          </div>
          <div className="truncate text-sm font-semibold text-gray-900">{node.title}</div>
          {!isQuestion ? (
            <div
              className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium"
              style={{ color: style.border }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: style.border }}
              />
              {style.label}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-1 text-lg leading-none text-gray-400 hover:text-gray-700"
          aria-label="关闭"
        >
          ×
        </button>
      </div>

      <div className="flex shrink-0 gap-1 border-b border-gray-100 px-2 py-1.5">
        {(
          [
            ['chat', '对话'],
            ['meta', '元信息 / 引用'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
              tab === id
                ? 'bg-blue-50 text-blue-800'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showConfirm ? (
        <div className="shrink-0 border-b border-amber-100 bg-amber-50/90 px-3 py-2">
          <p className="text-[11px] font-medium text-amber-950">等待确认 · 可在此收束</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={onConfirmFinish}
              className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100"
            >
              结束并出报告
            </button>
            {onConfirmContinue ? (
              <button
                type="button"
                onClick={onConfirmContinue}
                className="rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-900 hover:bg-teal-100"
              >
                继续深挖
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'chat' ? (
        <>
          <div ref={listRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
            {messages.map((m) => (
              <div key={m.id} className="space-y-1.5">
                <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[92%] rounded-lg px-2.5 py-2 text-[12px] leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : m.role === 'system'
                          ? 'border border-gray-200 bg-gray-50 text-gray-600'
                          : 'border border-gray-200 bg-white text-gray-800'
                    }`}
                  >
                    {m.text}
                    {m.streaming ? (
                      <span className="ml-0.5 inline-block animate-pulse">▍</span>
                    ) : null}
                  </div>
                </div>
                {m.proposals && m.proposals.length > 0 ? (
                  <div className="space-y-1.5 pl-0.5">
                    {m.proposals.map((p) => (
                      <div
                        key={p.id}
                        className={`rounded-lg border px-2.5 py-2 ${
                          p.status === 'pending'
                            ? 'border-blue-200 bg-blue-50/80'
                            : p.status === 'accepted'
                              ? 'border-emerald-200 bg-emerald-50/70'
                              : 'border-gray-200 bg-gray-50 opacity-70'
                        }`}
                        {...tid(TestIds.researchLabChatAction)}
                      >
                        <div className="text-[11px] font-semibold text-gray-900">{p.label}</div>
                        <p className="mt-0.5 text-[10px] leading-snug text-gray-600">
                          {p.rationale}
                        </p>
                        {p.params?.query ? (
                          <p className="mt-1 truncate font-mono text-[10px] text-gray-500">
                            → {p.params.query}
                          </p>
                        ) : null}
                        {p.params?.conclusionStatus ? (
                          <p className="mt-1 text-[10px] text-gray-500">
                            → status: {p.params.conclusionStatus}
                          </p>
                        ) : null}
                        {p.status === 'pending' ? (
                          <div className="mt-1.5 flex gap-1.5">
                            <button
                              type="button"
                              className="rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-blue-700"
                              {...tid(TestIds.researchLabChatActionAccept)}
                              onClick={() => {
                                if (runAction(p, 'chat')) {
                                  patchProposal(m.id, p.id, 'accepted');
                                }
                              }}
                            >
                              确认执行
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50"
                              {...tid(TestIds.researchLabChatActionDismiss)}
                              onClick={() => patchProposal(m.id, p.id, 'dismissed')}
                            >
                              忽略
                            </button>
                          </div>
                        ) : (
                          <p className="mt-1 text-[10px] font-medium text-gray-500">
                            {p.status === 'accepted' ? '已执行' : '已忽略'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="shrink-0 border-t border-gray-100 p-2.5">
            {quickGroups.length > 0 ? (
              <div className="mb-2 space-y-1.5">
                {quickGroups.map((group) => (
                  <div key={group.id} className="flex items-start gap-1.5">
                    <span className="mt-0.5 w-7 shrink-0 text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                      {group.label}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                      {group.actions.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          title={a.title}
                          disabled={streaming || a.disabled}
                          onClick={() => runAction(a.proposal, 'badge')}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-45 ${QUICK_ACTION_TONE_CLASS[a.tone]} ${
                            a.active ? QUICK_ACTION_ACTIVE_CLASS : ''
                          }`}
                          {...tid(TestIds.researchLabChatQuickAction)}
                        >
                          {a.active ? `✓ ${a.label}` : a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex gap-1.5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                placeholder="对本节点提问…或点上方「定态 / 结构」徽章"
                className="min-h-[56px] flex-1 resize-none rounded-md border border-gray-200 px-2.5 py-2 text-[12px] outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
                {...tid(TestIds.researchLabChatInput)}
              />
              <button
                type="button"
                disabled={streaming || !input.trim()}
                onClick={() => void send()}
                className="self-end rounded-md bg-blue-600 px-3 py-2 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                {...tid(TestIds.researchLabChatSend)}
              >
                发送
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400">
              会话绑定 <span className="font-mono">{node.id}</span>· 定态会改写发现文案；结构变更会
              reshape 图谱
            </p>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
          {isQuestion && constraintsNote ? (
            <section>
              <h3 className="mb-1 text-[10px] uppercase tracking-wider text-gray-400">约束</h3>
              <p className="text-xs leading-relaxed text-gray-600">{constraintsNote}</p>
            </section>
          ) : null}

          {isQuestion && onEdit ? (
            <section className="rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="mb-0.5 text-[10px] uppercase tracking-wider text-teal-800/70">
                    研究中断询问
                  </h3>
                  <p className="text-[11px] leading-snug text-gray-600">
                    开启后跑到确认点会停；关闭则自动收束。确认操作也可在对话页顶部完成。
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={node.askOnInterrupt !== false}
                  onClick={() => onEdit(node.id, { askOnInterrupt: node.askOnInterrupt === false })}
                  className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
                    node.askOnInterrupt !== false ? 'bg-teal-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      node.askOnInterrupt !== false ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </section>
          ) : null}

          {node.conclusion ? (
            <section>
              <h3 className="mb-1 text-[10px] uppercase tracking-wider text-gray-400">
                {isConclusion ? '最终结论' : isQuestion ? '原始问题' : '研究发现'}
              </h3>
              <p
                className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700"
                {...(isQuestion ? tid(TestIds.researchLabTopic) : {})}
              >
                {node.conclusion}
              </p>
            </section>
          ) : null}

          {node.summary && !isQuestion ? (
            <section>
              <h3 className="mb-1 text-[10px] uppercase tracking-wider text-gray-400">摘要</h3>
              <p className="text-xs leading-relaxed text-gray-600">{node.summary}</p>
            </section>
          ) : null}

          {node.query ? (
            <section>
              <h3 className="mb-1 text-[10px] uppercase tracking-wider text-gray-400">检索查询</h3>
              <p className="break-all rounded bg-gray-50 px-2 py-1.5 font-mono text-[11px] text-gray-500">
                {node.query}
              </p>
            </section>
          ) : null}

          {isConclusion ? (
            <section>
              <h3 className="mb-2 text-[10px] uppercase tracking-wider text-gray-400">综述报告</h3>
              {reportAvailable && onOpenReport ? (
                <button
                  type="button"
                  onClick={onOpenReport}
                  className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 hover:bg-amber-100"
                  {...tid(TestIds.researchLabReport)}
                >
                  打开独立报告页
                </button>
              ) : (
                <p className="text-xs text-gray-400">报告将在关系整合后可打开。</p>
              )}
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-[10px] uppercase tracking-wider text-gray-400">信息引用源</h3>
            {isQuestion ? (
              <p className="text-xs text-gray-400">提问节点无检索引用；见研究/结论节点。</p>
            ) : cites.length === 0 ? (
              <p className="text-xs text-gray-400">暂无引用</p>
            ) : (
              <ul className="space-y-2">
                {cites.map((c) => (
                  <li
                    key={c.id}
                    className={`rounded-lg border px-3 py-2 ${
                      c.stale ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase text-gray-400">{c.kind}</span>
                      {c.origin === 'notebook' ? (
                        <span className="text-[10px] text-blue-600">笔记本</span>
                      ) : (
                        <span className="text-[10px] text-gray-400">研究检索</span>
                      )}
                      {c.stale ? (
                        <span className="text-[10px] font-semibold text-amber-700">可能过时</span>
                      ) : null}
                    </div>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block truncate text-xs font-medium text-blue-700 hover:underline"
                    >
                      {c.title}
                    </a>
                    <p className="mt-1 text-[11px] leading-snug text-gray-600">{c.snippet}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {onEdit && !isConclusion ? (
            <section className="rounded-md border border-dashed border-gray-200 px-3 py-2">
              <p className="text-[11px] text-gray-500">
                改检索查询会触发流程重塑（对应后端 reshape）；标题/摘要/结论仅覆盖展示字段。
              </p>
              <button
                type="button"
                className="mt-2 text-[11px] font-medium text-blue-700 hover:underline"
                onClick={() => {
                  const next = window.prompt('检索查询（空则取消）', node.query ?? '');
                  if (next === null) return;
                  onEdit(node.id, { query: next.trim() || undefined });
                }}
              >
                快速改查询…
              </button>
            </section>
          ) : null}
        </div>
      )}
    </aside>
  );
}
