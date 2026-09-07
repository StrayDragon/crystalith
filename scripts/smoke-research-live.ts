#!/usr/bin/env bun
/**
 * Deep Research live smoke — real LLM, generous timeouts.
 *
 * Scenarios (order matters for prune):
 *   create_and_stream → node_chat_proposal → accept_prune → budget_finish → progress_revisions
 *
 * Usage (server already on :8032 with CL_* env loaded):
 *   bun scripts/smoke-research-live.ts
 *
 * Env:
 *   CL_SMOKE_BASE   default http://127.0.0.1:8032
 *   CL_SMOKE_DEPTH  shallow | medium | deep (default medium — needs research nodes for prune)
 */
const BASE = process.env.CL_SMOKE_BASE ?? 'http://127.0.0.1:8032';
const DEPTH = (process.env.CL_SMOKE_DEPTH ?? 'medium') as 'shallow' | 'medium' | 'deep';
const POLL_INTERVAL_MS = 5_000;
const STATUS_TIMEOUT_MS = 15 * 60 * 1000;
const HTTP_TIMEOUT_MS = 600_000;
const CHAT_SSE_TIMEOUT_MS = 10 * 60 * 1000;

type Result = { scenario: string; status: 'PASS' | 'FAIL' | 'SKIP'; evidence: string };
const results: Result[] = [];

function log(...args: unknown[]) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

async function fetchJson(
  path: string,
  opts: RequestInit & { timeoutMs?: number } = {},
): Promise<{ status: number; body: unknown; raw: string }> {
  const { timeoutMs = 120_000, ...init } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, signal: ctrl.signal });
    const raw = await res.text();
    let body: unknown = raw;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      /* keep raw */
    }
    return { status: res.status, body, raw };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForStatus(
  nid: number,
  rid: number,
  targets: string[],
): Promise<{ run: Record<string, unknown>; lastStatus: string; elapsed: number }> {
  const start = Date.now();
  let lastStatus = 'unknown';
  while (Date.now() - start < STATUS_TIMEOUT_MS) {
    const { status, body } = await fetchJson(`/v2/notebooks/${nid}/research/${rid}`, {
      timeoutMs: 120_000,
    });
    if (status !== 200) {
      throw new Error(`GET run failed ${status}: ${JSON.stringify(body)}`);
    }
    const run = body as Record<string, unknown>;
    lastStatus = String(run.status);
    log(
      `  poll status=${lastStatus} llm=${run.llmActivity ?? 'null'} nodes=${(run.nodes as unknown[])?.length ?? 0}`,
    );
    if (targets.includes(lastStatus)) {
      return { run, lastStatus, elapsed: Date.now() - start };
    }
    await Bun.sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Timeout waiting for ${targets.join('|')}; last=${lastStatus}`);
}

function hasQuestionAndConclusion(nodes: Array<Record<string, unknown>>): boolean {
  const hasQ = nodes.some((n) => n.role === 'question' || String(n.id).startsWith('node_root'));
  const hasC = nodes.some(
    (n) => n.role === 'conclusion' || String(n.id).startsWith('node_conclusion'),
  );
  return hasQ && hasC;
}

/** Prefer live research nodes (prune-capable); fall back to question. */
function pickChatNode(nodes: Array<Record<string, unknown>>): string | null {
  const live = nodes.filter((n) => n.conclusionStatus !== 'pruned');
  const research = live.find((n) => n.role === 'research');
  if (research) return String(research.id);
  const question = live.find((n) => n.role === 'question' || String(n.id).startsWith('node_root'));
  if (question) return String(question.id);
  return live[0] ? String(live[0].id) : null;
}

async function readSseBriefly(url: string, maxMs = 30_000): Promise<string[]> {
  const events: string[] = [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), maxMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok || !res.body) return [`http_${res.status}`];
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() ?? '';
      for (const block of parts) {
        const ev = block.match(/^event:\s*(.+)$/mu)?.[1]?.trim();
        if (ev) events.push(ev);
        if (events.length >= 3) {
          ctrl.abort();
          break;
        }
      }
    }
  } catch (error) {
    if (!String(error).includes('abort')) events.push(`error:${error}`);
  } finally {
    clearTimeout(timer);
  }
  return events;
}

async function readNodeChatSse(
  nid: number,
  rid: number,
  nodeId: string,
  message: string,
): Promise<{
  events: string[];
  chunks: number;
  proposals: Array<Record<string, unknown>>;
  error?: string;
}> {
  const events: string[] = [];
  const proposals: Array<Record<string, unknown>> = [];
  let chunks = 0;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CHAT_SSE_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${BASE}/v2/notebooks/${nid}/research/${rid}/nodes/${encodeURIComponent(nodeId)}/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ message }),
        signal: ctrl.signal,
      },
    );
    if (!res.ok || !res.body) {
      return { events, chunks, proposals, error: `http_${res.status}` };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() ?? '';
      for (const block of parts) {
        if (block.startsWith(':')) continue;
        const ev = block.match(/^event:\s*(.+)$/mu)?.[1]?.trim();
        const dataLine = block.match(/^data:\s*(.+)$/mu)?.[1]?.trim();
        if (ev) events.push(ev);
        if (ev === 'chunk') chunks++;
        if (ev === 'proposal' && dataLine) {
          try {
            proposals.push(JSON.parse(dataLine));
          } catch {
            /* ignore */
          }
        }
        if (ev === 'done' || ev === 'error') {
          ctrl.abort();
          break;
        }
      }
    }
  } catch (error) {
    if (!String(error).includes('abort')) {
      return { events, chunks, proposals, error: String(error) };
    }
  } finally {
    clearTimeout(timer);
  }
  return { events, chunks, proposals };
}

log('research live smoke starting', { BASE, DEPTH });

let gatewayInfo = 'unknown';
try {
  const gwBase = process.env.CL_CHAT_API_BASE ?? 'http://127.0.0.1:50256/v1';
  const gw = await fetch(`${gwBase}/models`, { signal: AbortSignal.timeout(15_000) });
  const gwBody = (await gw.json()) as { data?: Array<{ id: string }> };
  const modelId = process.env.CL_CHAT_MODEL ?? gwBody.data?.[0]?.id ?? 'n/a';
  gatewayInfo = `up ${gwBase} model=${modelId}`;
  log('gateway:', gatewayInfo);
} catch (error) {
  gatewayInfo = `DOWN: ${error}`;
  log('BLOCKER gateway:', gatewayInfo);
  console.log(
    JSON.stringify(
      {
        env: { BASE, DEPTH, gateway: gatewayInfo },
        results: [{ scenario: 'ALL', status: 'FAIL', evidence: 'gateway down' }],
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const nbRes = await fetchJson('/v2/notebooks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: `research-live-smoke-${Date.now()}` }),
  timeoutMs: 30_000,
});
if (nbRes.status !== 201) {
  console.error('notebook create failed', nbRes);
  process.exit(1);
}
const nid = (nbRes.body as { id: number }).id;
log('notebook', nid);

let rid = 0;
let run: Record<string, unknown> = {};
let nodeIdForChat: string | null = null;

// ── create_and_stream ─────────────────────────────────────────────────────
try {
  const createRes = await fetchJson(`/v2/notebooks/${nid}/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: '水晶石应用概览',
      allowWeb: true,
      useNotebookSources: false,
      depth: DEPTH,
    }),
    timeoutMs: HTTP_TIMEOUT_MS,
  });
  if (createRes.status !== 201) {
    results.push({
      scenario: 'create_and_stream',
      status: 'FAIL',
      evidence: `create ${createRes.status}: ${createRes.raw.slice(0, 200)}`,
    });
  } else {
    run = createRes.body as Record<string, unknown>;
    rid = run.id as number;
    log('research created', rid, 'status=', run.status);

    const sseEvents = await readSseBriefly(`${BASE}/v2/notebooks/${nid}/research/${rid}/stream`);
    log('SSE events (brief):', sseEvents);

    const waited = await waitForStatus(nid, rid, [
      'awaiting_confirm',
      'completed',
      'failed',
      'cancelled',
    ]);
    run = waited.run;
    const nodes = (run.nodes as Array<Record<string, unknown>>) ?? [];
    const graphOk = hasQuestionAndConclusion(nodes);
    const sseOk = sseEvents.some((e) =>
      ['status', 'graph_patch', 'progress', 'confirm', 'log'].includes(e),
    );
    const researchCount = nodes.filter((n) => n.role === 'research').length;
    nodeIdForChat = pickChatNode(nodes);
    results.push({
      scenario: 'create_and_stream',
      status: graphOk && sseOk ? 'PASS' : 'FAIL',
      evidence: `status=${waited.lastStatus} nodes=${nodes.length} research=${researchCount} graphQ+C=${graphOk} sse=[${sseEvents.join(',')}] ${Math.round(waited.elapsed / 1000)}s`,
    });
  }
} catch (error) {
  results.push({ scenario: 'create_and_stream', status: 'FAIL', evidence: String(error) });
}

if (rid) {
  const fresh = await fetchJson(`/v2/notebooks/${nid}/research/${rid}`);
  if (fresh.status === 200) run = fresh.body as Record<string, unknown>;
  nodeIdForChat =
    nodeIdForChat ?? pickChatNode((run.nodes as Array<Record<string, unknown>>) ?? []);
}

/**
 * Kernel today only creates `role=research` nodes on expand_branch approve,
 * which then synthesizes to completed — so live chat+prune never sees a
 * research node. For smoke coverage of Structure prune proposals, inject one
 * while still awaiting_confirm (same fixture pattern as unit tests).
 */
async function ensureLiveResearchNode(
  notebookId: number,
  runId: number,
  current: Record<string, unknown>,
): Promise<{ run: Record<string, unknown>; researchNodeId: string | null; injected: boolean }> {
  const nodes = (current.nodes as Array<Record<string, unknown>>) ?? [];
  const existing = nodes.find((n) => n.role === 'research' && n.conclusionStatus !== 'pruned');
  if (existing) {
    return { run: current, researchNodeId: String(existing.id), injected: false };
  }
  if (String(current.status) !== 'awaiting_confirm') {
    return { run: current, researchNodeId: null, injected: false };
  }

  const question =
    nodes.find((n) => n.role === 'question') ??
    nodes.find((n) => String(n.id).startsWith('node_root'));
  const conclusion =
    nodes.find((n) => n.role === 'conclusion') ??
    nodes.find((n) => String(n.id).startsWith('node_conclusion'));
  if (!question || !conclusion) {
    return { run: current, researchNodeId: null, injected: false };
  }

  const { Database } = await import('bun:sqlite');
  const { join } = await import('node:path');
  const dbPath = process.env.CL_DB_PATH ?? join(process.cwd(), 'data', 'crystalith.db');
  const researchId = `node_research_smoke_${Date.now().toString(36)}`;
  const db = new Database(dbPath);
  try {
    const row = db
      .query('SELECT graph FROM research_runs WHERE id = ? AND notebook_id = ?')
      .get(runId, notebookId) as { graph: string } | null;
    if (!row?.graph) return { run: current, researchNodeId: null, injected: false };
    const graph = JSON.parse(row.graph) as {
      nodes: Array<Record<string, unknown>>;
      edges: Array<Record<string, unknown>>;
    };
    graph.nodes.push({
      id: researchId,
      role: 'research',
      title: '烟雾测试支路',
      query: String(current.topic ?? 'smoke'),
      conclusionStatus: 'partial',
      phase: 'idle',
      evidenceIds: [],
    });
    graph.edges.push(
      {
        id: `edge_fork_${researchId}`,
        source: String(question.id),
        target: researchId,
        kind: 'fork',
      },
      {
        id: `edge_merge_${researchId}`,
        source: researchId,
        target: String(conclusion.id),
        kind: 'merge',
      },
    );
    db.run('UPDATE research_runs SET graph = ?, llm_activity = NULL WHERE id = ?', [
      JSON.stringify(graph),
      runId,
    ]);
  } finally {
    db.close();
  }

  const refreshed = await fetchJson(`/v2/notebooks/${notebookId}/research/${runId}`);
  const next = refreshed.body as Record<string, unknown>;
  return { run: next, researchNodeId: researchId, injected: true };
}

let injectedResearch = false;
if (rid && String(run.status) === 'awaiting_confirm') {
  const ensured = await ensureLiveResearchNode(nid, rid, run);
  run = ensured.run;
  if (ensured.researchNodeId) {
    nodeIdForChat = ensured.researchNodeId;
    injectedResearch = ensured.injected;
    log(
      'research node for prune coverage',
      ensured.researchNodeId,
      injectedResearch ? '(injected fixture)' : '(from kernel)',
    );
  }
}

// ── node_chat_proposal (while live / awaiting_confirm) ────────────────────
try {
  if (!rid || !nodeIdForChat) {
    results.push({ scenario: 'node_chat_proposal', status: 'SKIP', evidence: 'no live node' });
  } else if (['failed', 'cancelled', 'completed'].includes(String(run.status))) {
    results.push({
      scenario: 'node_chat_proposal',
      status: 'SKIP',
      evidence: `status=${run.status} (need awaiting_confirm/running for prune accept)`,
    });
  } else {
    const chat = await readNodeChatSse(nid, rid, nodeIdForChat, '请剪枝这个节点');
    const afterRes = await fetchJson(`/v2/notebooks/${nid}/research/${rid}`);
    const afterRun = afterRes.body as Record<string, unknown>;
    const afterNodes = (afterRun.nodes ?? []) as Array<Record<string, unknown>>;
    const after = afterNodes.find((n) => n.id === nodeIdForChat);
    const stillLive = after?.conclusionStatus !== 'pruned';
    const hasChunk = chat.chunks > 0 || chat.events.includes('chunk');
    const hasConnected = chat.events.includes('log');
    const hasPruneProposal = chat.proposals.some((p) => p.kind === 'prune_node');
    const mutexCleared = afterRun.llmActivity === null || afterRun.llmActivity === undefined;
    const role = after?.role ?? 'unknown';
    // prune_node proposals only exist for research-role Structure tools;
    // agent may emit proposal+done with no text chunks.
    const expectPrune = role === 'research';
    const ok =
      stillLive &&
      hasConnected &&
      mutexCleared &&
      chat.events.includes('done') &&
      (expectPrune ? hasPruneProposal : hasChunk);
    results.push({
      scenario: 'node_chat_proposal',
      status: ok ? 'PASS' : 'FAIL',
      evidence: `node=${nodeIdForChat} role=${role} injected=${injectedResearch} events=[${[...new Set(chat.events)].join(',')}] chunks=${chat.chunks} pruneProposal=${hasPruneProposal} stillLive=${stillLive} llmCleared=${mutexCleared}${chat.error ? ` err=${chat.error}` : ''}`,
    });
  }
} catch (error) {
  results.push({ scenario: 'node_chat_proposal', status: 'FAIL', evidence: String(error) });
}

// ── accept_prune ──────────────────────────────────────────────────────────
try {
  if (!rid || !nodeIdForChat) {
    results.push({ scenario: 'accept_prune', status: 'SKIP', evidence: 'no node' });
  } else if (['completed', 'failed', 'cancelled'].includes(String(run.status))) {
    results.push({
      scenario: 'accept_prune',
      status: 'SKIP',
      evidence: `status=${run.status}`,
    });
  } else {
    const nodes = (run.nodes as Array<Record<string, unknown>>) ?? [];
    const target = nodes.find((n) => n.id === nodeIdForChat);
    if (target?.role !== 'research') {
      results.push({
        scenario: 'accept_prune',
        status: 'SKIP',
        evidence: `node role=${target?.role ?? 'missing'} (need research node; try CL_SMOKE_DEPTH=medium)`,
      });
    } else {
      const pruneRes = await fetchJson(
        `/v2/notebooks/${nid}/research/${rid}/nodes/${encodeURIComponent(nodeIdForChat)}/prune`,
        { method: 'POST', timeoutMs: 60_000 },
      );
      const pruned = ((pruneRes.body as Record<string, unknown>)?.nodes ?? []) as Array<
        Record<string, unknown>
      >;
      const node = pruned.find((n) => n.id === nodeIdForChat);
      results.push({
        scenario: 'accept_prune',
        status: pruneRes.status === 200 && node?.conclusionStatus === 'pruned' ? 'PASS' : 'FAIL',
        evidence: `prune ${pruneRes.status} nodeStatus=${node?.conclusionStatus}`,
      });
      if (pruneRes.status === 200) run = pruneRes.body as Record<string, unknown>;
    }
  }
} catch (error) {
  results.push({ scenario: 'accept_prune', status: 'FAIL', evidence: String(error) });
}

// ── budget_finish ─────────────────────────────────────────────────────────
try {
  const fresh = rid ? await fetchJson(`/v2/notebooks/${nid}/research/${rid}`) : null;
  if (fresh?.status === 200) run = fresh.body as Record<string, unknown>;

  if (!rid) {
    results.push({ scenario: 'budget_finish', status: 'SKIP', evidence: 'no run' });
  } else if (run.status === 'awaiting_confirm') {
    const confirmRes = await fetchJson(`/v2/notebooks/${nid}/research/${rid}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'finish_report' }),
      timeoutMs: HTTP_TIMEOUT_MS,
    });
    if (confirmRes.status !== 200) {
      results.push({
        scenario: 'budget_finish',
        status: 'FAIL',
        evidence: `confirm ${confirmRes.status}: ${confirmRes.raw.slice(0, 200)}`,
      });
    } else {
      const waited = await waitForStatus(nid, rid, ['completed', 'failed', 'cancelled']);
      run = waited.run;
      const hasReport = run.report !== null && run.report !== undefined;
      const ok = waited.lastStatus === 'completed' && hasReport;
      results.push({
        scenario: 'budget_finish',
        status: ok ? 'PASS' : 'FAIL',
        evidence: `status=${waited.lastStatus} report=${hasReport} ${Math.round(waited.elapsed / 1000)}s`,
      });
    }
  } else if (run.status === 'completed') {
    const hasReport = run.report !== null && run.report !== undefined;
    results.push({
      scenario: 'budget_finish',
      status: hasReport ? 'PASS' : 'FAIL',
      evidence: `already completed report=${hasReport}`,
    });
  } else {
    results.push({
      scenario: 'budget_finish',
      status: 'SKIP',
      evidence: `status=${run.status}`,
    });
  }
} catch (error) {
  results.push({ scenario: 'budget_finish', status: 'FAIL', evidence: String(error) });
}

// ── progress_revisions ────────────────────────────────────────────────────
try {
  if (!rid) {
    results.push({ scenario: 'progress_revisions', status: 'SKIP', evidence: 'no run' });
  } else if (run.status !== 'completed') {
    results.push({
      scenario: 'progress_revisions',
      status: 'SKIP',
      evidence: `status=${run.status}`,
    });
  } else {
    const prog = await fetchJson(`/v2/notebooks/${nid}/research/${rid}/progress?limit=50`);
    const items = (prog.body as { items?: unknown[] })?.items ?? [];
    const rev = await fetchJson(`/v2/notebooks/${nid}/research/${rid}/revisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'live-smoke' }),
      timeoutMs: 60_000,
    });
    const ok = prog.status === 200 && items.length > 0 && rev.status === 201;
    results.push({
      scenario: 'progress_revisions',
      status: ok ? 'PASS' : 'FAIL',
      evidence: `progress=${items.length} items rev=${rev.status}`,
    });
  }
} catch (error) {
  results.push({ scenario: 'progress_revisions', status: 'FAIL', evidence: String(error) });
}

const report = {
  env: { BASE, DEPTH, gateway: gatewayInfo, notebookId: nid, runId: rid },
  results,
  summary: {
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    skip: results.filter((r) => r.status === 'SKIP').length,
  },
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.summary.fail > 0 ? 1 : 0);
