/**
 * Node drawer chat state machine (W6): messages, input, streaming transport
 * (Eden SSE vs fixture typewriter), per-node history cache and autoscroll.
 * Action-proposal confirmation stays in the drawer (action layer).
 */
import type { ResearchNodeActionProposal } from '@crystalith/shared';
import { useEffect, useRef, useState } from 'react';

import { streamNodeChat } from './edenResearchApi';
import type { LabNodeActionProposal } from './model/nodeChatTypes';
import { fixtureTypewriter, proposeNodeChatTurn } from './model/proposeNodeChatTurn';
import type { LabNode, LabPhase } from './model/types';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface NodeChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  streaming?: boolean;
  proposals?: LabNodeActionProposal[];
}

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

function toLabProposal(p: ResearchNodeActionProposal): LabNodeActionProposal {
  return {
    id: p.id,
    kind: p.kind,
    label: p.label,
    rationale: p.rationale,
    status: p.status ?? 'pending',
    params: p.params,
  };
}

function mergeProposals(
  existing: LabNodeActionProposal[],
  incoming: LabNodeActionProposal[],
): LabNodeActionProposal[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const p of incoming) byId.set(p.id, p);
  return [...byId.values()];
}

export interface UseNodeChatOptions {
  node: LabNode | null;
  phase: LabPhase;
  mode: 'fixture' | 'eden';
  notebookId?: number;
  runId?: number | null;
  reportAvailable?: boolean;
  llmBusy: boolean;
  onChatError?: (message: string) => void;
}

export function useNodeChat({
  node,
  phase,
  mode,
  notebookId,
  runId,
  reportAvailable,
  llmBusy,
  onChatError,
}: UseNodeChatOptions) {
  const [messages, setMessages] = useState<NodeChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nodeIdRef = useRef<string | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  // Per-node histories survive selection switches within this drawer's
  // lifetime (W6: was a module-level Map — process-wide and never released).
  const historyCacheRef = useRef(new Map<string, NodeChatMessage[]>());

  useEffect(() => {
    if (!node) return;
    nodeIdRef.current = node.id;
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    const existing = historyCacheRef.current.get(node.id);
    setMessages(existing ?? seedMessages(node));
    setInput('');
    setStreaming(false);
    setChatError(null);
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- selection switch only

  useEffect(() => {
    return () => {
      chatAbortRef.current?.abort();
      chatAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!node) return;
    historyCacheRef.current.set(node.id, messages);
  }, [node, messages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const sendBusy = streaming || llmBusy;
  const sendDisabled = sendBusy || !input.trim() || (mode === 'eden' && (!notebookId || !runId));

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

  const send = async () => {
    if (!node) return;
    const text = input.trim();
    if (!text || sendBusy) return;
    if (mode === 'eden' && (!notebookId || !runId)) {
      const msg = '无法发送：缺少 ResearchRun';
      setChatError(msg);
      onChatError?.(msg);
      return;
    }
    setInput('');
    setChatError(null);
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

    if (mode === 'fixture') {
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

      await fixtureTypewriter(turn.assistantText, (partial, done) => {
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
      return;
    }

    // Eden: POST …/nodes/:nodeId/chat SSE (MUST NOT proposeNodeChatTurn).
    chatAbortRef.current?.abort();
    const ac = new AbortController();
    chatAbortRef.current = ac;
    let acc = '';
    let proposals: LabNodeActionProposal[] = [];
    try {
      for await (const ev of streamNodeChat(
        notebookId!,
        runId!,
        node.id,
        { message: text },
        {
          signal: ac.signal,
        },
      )) {
        if (ac.signal.aborted || nodeIdRef.current !== node.id) break;
        if (ev.event === 'chunk') {
          acc += ev.data.text;
          const textSnap = acc;
          const proposalsSnap = proposals;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId
                ? { ...m, text: textSnap, streaming: true, proposals: proposalsSnap }
                : m,
            ),
          );
        } else if (ev.event === 'proposal') {
          proposals = mergeProposals(proposals, [toLabProposal(ev.data)]);
          const textSnap = acc;
          const proposalsSnap = proposals;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId
                ? { ...m, text: textSnap, streaming: true, proposals: proposalsSnap }
                : m,
            ),
          );
        } else if (ev.event === 'done') {
          if (ev.data.proposals?.length) {
            proposals = mergeProposals(proposals, ev.data.proposals.map(toLabProposal));
          }
          const textSnap = acc;
          const proposalsSnap = proposals;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId
                ? { ...m, text: textSnap, streaming: false, proposals: proposalsSnap }
                : m,
            ),
          );
        } else if (ev.event === 'error') {
          const msg = ev.data.message || ev.data.errorCode || '节点对话失败';
          setChatError(msg);
          onChatError?.(msg);
          const textSnap = acc || msg;
          const proposalsSnap = proposals;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId
                ? { ...m, text: textSnap, streaming: false, proposals: proposalsSnap }
                : m,
            ),
          );
        }
      }
    } catch (error) {
      if (ac.signal.aborted) return;
      const msg = error instanceof Error ? error.message : String(error);
      setChatError(msg);
      onChatError?.(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId ? { ...m, text: acc || msg, streaming: false, proposals } : m,
        ),
      );
    } finally {
      if (chatAbortRef.current === ac) chatAbortRef.current = null;
      if (nodeIdRef.current === node.id) setStreaming(false);
    }
  };

  return {
    messages,
    setMessages,
    input,
    setInput,
    streaming,
    chatError,
    setChatError,
    listRef,
    sendBusy,
    sendDisabled,
    send,
    patchProposal,
  };
}
