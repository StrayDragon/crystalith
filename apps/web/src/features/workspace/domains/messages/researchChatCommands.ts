/**
 * Workspace chat deep-research slash commands (c99 / r452).
 * Slash-only — no @ mention surface.
 */

export type ResearchChatAction =
  | { type: 'open_compose'; topic: string | null }
  | { type: 'open_run'; runId: number };

const COMPOSE_RE = /^\/(?:research|深研)(?:\s+(.*))?$/iu;
const OPEN_RUN_RE = /^\/research-open(?:\s+(\d+))?\s*$/iu;

/** Parse a full chat draft (trimmed). Returns null if not a research nav command. */
export function parseResearchChatCommand(raw: string): ResearchChatAction | null {
  const text = raw.trim();
  if (!text.startsWith('/')) return null;

  const open = OPEN_RUN_RE.exec(text);
  if (open) {
    const rid = Number(open[1]);
    if (!Number.isFinite(rid) || rid <= 0) {
      return null;
    }
    return { type: 'open_run', runId: rid };
  }

  // Bare `/research-open` without rid — treat as research command that failed parse
  // so callers can show error instead of sending to QA.
  if (/^\/research-open\b/iu.test(text)) {
    return null;
  }

  const compose = COMPOSE_RE.exec(text);
  if (compose) {
    const topic = (compose[1] ?? '').trim();
    return { type: 'open_compose', topic: topic.length > 0 ? topic : null };
  }

  return null;
}

/** True when the draft is a research slash (including invalid `/research-open` bare). */
export function isResearchChatCommandLine(raw: string): boolean {
  const text = raw.trim();
  if (parseResearchChatCommand(text)) return true;
  return /^\/(?:research|深研|research-open)(?:\s|$)/iu.test(text);
}

export type ResearchChatExecuteResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export function executeResearchChatCommand(
  action: ResearchChatAction,
  notebookId: number,
  navigate: (notebookId: number, runId?: number | null, opts?: { topic?: string }) => void,
): ResearchChatExecuteResult {
  if (!Number.isFinite(notebookId) || notebookId <= 0) {
    return { ok: false, error: '请先创建笔记本。' };
  }
  if (action.type === 'open_run') {
    navigate(notebookId, action.runId);
    return { ok: true, message: `已打开深研 Run #${action.runId}` };
  }
  navigate(notebookId, null, action.topic ? { topic: action.topic } : undefined);
  return {
    ok: true,
    message: action.topic ? '已打开深研 Compose（已预填主题）' : '已打开深研 Compose',
  };
}
