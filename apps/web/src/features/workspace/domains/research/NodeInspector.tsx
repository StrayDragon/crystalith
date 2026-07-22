import type {
  ResearchConclusionStatus,
  ResearchNode,
  ResearchNodeActionProposal,
  ResearchNodePatchBody,
} from '@crystalith/shared';
import { Typography } from '@material-tailwind/react';
import { useEffect, useRef, useState } from 'react';

import ConfirmPopover from '../../../../shared/ConfirmPopover';
import { t } from '../../../../shared/i18n';
import { TestIds, tid } from '../../../../shared/testids';

const STATUS_OPTIONS: ResearchConclusionStatus[] = ['pending', 'partial', 'clear', 'missing'];

export interface NodeInspectorProps {
  node: ResearchNode | null;
  readOnly: boolean;
  busy?: boolean;
  chatBusy?: boolean;
  onPrune: (nodeId: string) => void;
  onFork: (nodeId: string, hint?: string) => void;
  onPatch: (nodeId: string, body: ResearchNodePatchBody) => Promise<unknown>;
  onChat: (
    nodeId: string,
    message: string,
    opts: {
      signal: AbortSignal;
      onChunk: (text: string) => void;
      onProposal: (proposal: ResearchNodeActionProposal) => void;
    },
  ) => Promise<{ text: string; proposals: ResearchNodeActionProposal[] } | null>;
  onAcceptProposal: (nodeId: string, proposal: ResearchNodeActionProposal) => Promise<boolean>;
  onConvertNote: (nodeId: string) => void;
  onConvertSource: (nodeId: string) => void;
  onClose: () => void;
}

export default function NodeInspector({
  node,
  readOnly,
  busy,
  chatBusy,
  onPrune,
  onFork,
  onPatch,
  onChat,
  onAcceptProposal,
  onConvertNote,
  onConvertSource,
  onClose,
}: NodeInspectorProps) {
  const [hint, setHint] = useState('');
  const [queryDraft, setQueryDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState<ResearchConclusionStatus>('pending');
  const [chatInput, setChatInput] = useState('');
  const [chatText, setChatText] = useState('');
  const [proposals, setProposals] = useState<ResearchNodeActionProposal[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setHint('');
    setChatInput('');
    setChatText('');
    setProposals([]);
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    if (node) {
      setQueryDraft(node.query ?? '');
      setStatusDraft(node.conclusionStatus === 'pruned' ? 'pending' : node.conclusionStatus);
    }
  }, [node?.id]);

  if (!node) return null;

  const canPatch = !readOnly && node.conclusionStatus !== 'pruned';
  const patchDirty =
    queryDraft !== (node.query ?? '') ||
    (statusDraft !== node.conclusionStatus && node.conclusionStatus !== 'pruned');

  const sendChat = async () => {
    const message = chatInput.trim();
    if (!message || streaming || chatBusy) return;
    setChatInput('');
    setChatText('');
    setProposals([]);
    setStreaming(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const result = await onChat(node.id, message, {
      signal: ac.signal,
      onChunk: (text) => setChatText(text),
      onProposal: (p) => setProposals((prev) => [...prev, p]),
    });
    if (result) {
      setChatText(result.text);
      setProposals(result.proposals);
    }
    setStreaming(false);
    abortRef.current = null;
  };

  return (
    <aside
      className="w-72 shrink-0 border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 flex flex-col gap-3 overflow-y-auto"
      {...tid(TestIds.researchNodeInspector)}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <Typography variant="small" className="font-semibold text-gray-900 dark:text-slate-100">
            {node.title}
          </Typography>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {node.role ?? '—'} · {node.conclusionStatus}
          </div>
        </div>
        <button
          type="button"
          className="text-xs text-gray-400 hover:text-gray-600"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          ×
        </button>
      </div>

      {canPatch ? (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-100 dark:border-slate-800 p-2">
          <label className="text-[11px] text-gray-500">
            {t('research.inspector.query')}
            <textarea
              className="mt-1 w-full min-h-[52px] px-2 py-1 rounded border border-gray-200 dark:border-slate-600 text-xs bg-transparent"
              value={queryDraft}
              onChange={(e) => setQueryDraft(e.target.value)}
              disabled={busy}
              {...tid(TestIds.researchNodePatchQuery)}
            />
          </label>
          <label className="text-[11px] text-gray-500">
            {t('research.inspector.status')}
            <select
              className="mt-1 w-full h-8 px-2 rounded border border-gray-200 dark:border-slate-600 text-xs bg-transparent"
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value as ResearchConclusionStatus)}
              disabled={busy}
              {...tid(TestIds.researchNodePatchStatus)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="h-8 rounded-lg text-xs bg-slate-900 text-white disabled:opacity-40"
            disabled={busy || !patchDirty}
            {...tid(TestIds.researchNodePatchSave)}
            onClick={() => {
              const body: ResearchNodePatchBody = {};
              if (queryDraft !== (node.query ?? '')) body.query = queryDraft;
              if (statusDraft !== node.conclusionStatus) body.conclusionStatus = statusDraft;
              void onPatch(node.id, body);
            }}
          >
            {t('research.inspector.save_patch')}
          </button>
        </div>
      ) : null}

      {node.summary ? (
        <p className="text-xs text-gray-600 dark:text-slate-300 whitespace-pre-wrap">
          {node.summary}
        </p>
      ) : null}

      {!readOnly && node.conclusionStatus !== 'pruned' ? (
        <div className="flex flex-col gap-2 border-t border-gray-100 dark:border-slate-800 pt-2">
          <div className="min-h-[48px] max-h-28 overflow-y-auto rounded border border-gray-100 bg-slate-50 px-2 py-1.5 text-[11px] text-gray-700 whitespace-pre-wrap">
            {chatText || (streaming ? '…' : '—')}
          </div>
          {proposals.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-2"
              {...tid(TestIds.researchNodeChatProposal)}
            >
              <div className="text-[11px] font-medium text-indigo-900">{p.label}</div>
              <p className="mt-0.5 text-[10px] text-indigo-800/80">{p.rationale}</p>
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  className="h-6 px-2 rounded text-[10px] bg-indigo-600 text-white disabled:opacity-40"
                  disabled={busy || streaming}
                  {...tid(TestIds.researchNodeChatAccept)}
                  onClick={() => void onAcceptProposal(node.id, p)}
                >
                  {t('research.inspector.accept')}
                </button>
                <button
                  type="button"
                  className="h-6 px-2 rounded text-[10px] text-gray-500 hover:bg-white"
                  disabled={busy || streaming}
                  onClick={() => setProposals((prev) => prev.filter((x) => x.id !== p.id))}
                >
                  {t('research.inspector.dismiss')}
                </button>
              </div>
            </div>
          ))}
          <div className="flex gap-1.5">
            <input
              className="flex-1 h-8 px-2 rounded border border-gray-200 dark:border-slate-600 text-xs bg-transparent"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={t('research.inspector.chat_placeholder')}
              disabled={busy || streaming || chatBusy}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendChat();
                }
              }}
              {...tid(TestIds.researchNodeChatInput)}
            />
            <button
              type="button"
              className="h-8 px-2.5 rounded-lg text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
              disabled={busy || streaming || chatBusy || !chatInput.trim()}
              onClick={() => void sendChat()}
              {...tid(TestIds.researchNodeChatSend)}
            >
              {t('research.inspector.chat_send')}
            </button>
          </div>
        </div>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-col gap-2 mt-auto">
          <label className="text-[11px] text-gray-500">
            {t('research.inspector.fork_hint')}
            <input
              className="mt-1 w-full h-8 px-2 rounded border border-gray-200 dark:border-slate-600 text-xs bg-transparent"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder={t('research.inspector.fork_hint_placeholder')}
              disabled={busy}
            />
          </label>
          <ConfirmPopover
            message={t('research.inspector.fork_confirm')}
            onConfirm={() => onFork(node.id, hint.trim() || undefined)}
            disabled={busy}
          >
            <button
              type="button"
              className="w-full h-8 rounded-lg text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              disabled={busy}
            >
              {t('research.inspector.fork')}
            </button>
          </ConfirmPopover>
          <ConfirmPopover
            message={t('research.inspector.prune_confirm')}
            onConfirm={() => onPrune(node.id)}
            disabled={busy}
          >
            <button
              type="button"
              className="w-full h-8 rounded-lg text-xs bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
              disabled={busy}
            >
              {t('research.inspector.prune')}
            </button>
          </ConfirmPopover>
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-1.5 opacity-60">
            <span className="text-[10px] text-gray-400">
              {t('research.inspector.convert_faded')}
            </span>
            <button
              type="button"
              className="w-full h-7 rounded text-[11px] text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              disabled={busy}
              onClick={() => onConvertNote(node.id)}
            >
              {t('research.convert.to_note')}
            </button>
            <button
              type="button"
              className="w-full h-7 rounded text-[11px] text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              disabled={busy}
              onClick={() => onConvertSource(node.id)}
            >
              {t('research.convert.to_source')}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-auto pt-2 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-1.5 opacity-60">
          <span className="text-[10px] text-gray-400">{t('research.inspector.convert_faded')}</span>
          <button
            type="button"
            className="w-full h-7 rounded text-[11px] text-gray-500 hover:bg-gray-50"
            onClick={() => onConvertNote(node.id)}
          >
            {t('research.convert.to_note')}
          </button>
          <button
            type="button"
            className="w-full h-7 rounded text-[11px] text-gray-500 hover:bg-gray-50"
            onClick={() => onConvertSource(node.id)}
          >
            {t('research.convert.to_source')}
          </button>
        </div>
      )}
    </aside>
  );
}
