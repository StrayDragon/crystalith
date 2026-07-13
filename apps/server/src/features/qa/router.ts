// QA router — /v2/qa (non-streaming), /v2/qa/stream (SSE), /v2/qa/export
//
// Mirrors v1 `features/qa/api.py` on Elysia + AI SDK streamText.
// c36: deterministic retrieval (retrieveAndJudge) + evidence short-circuit.
import { and, eq, inArray } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { messages, notebooks, sessions, sources } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { streamQa, generateQaDirect } from './handler.ts';
import { resolvePreset, listPresets } from './presets.ts';

// ---------------------------------------------------------------------------
// OpenAPI docs
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/qa',
    method: 'post',
    summary: 'Ask a question (non-streaming)',
    tags: ['qa'],
    responses: { 200: { description: 'QA response' } },
  },
  {
    path: '/v2/qa/stream',
    method: 'post',
    summary: 'Ask a question (SSE streaming)',
    tags: ['qa'],
    responses: { 200: { description: 'SSE event stream', contentType: 'text/event-stream' } },
  },
  {
    path: '/v2/qa/export',
    method: 'get',
    summary: 'Export a QA answer (markdown or json)',
    tags: ['qa'],
    responses: { 200: { description: 'Exported QA answer' } },
  },
  {
    path: '/v2/qa/presets',
    method: 'get',
    summary: 'List available QA presets',
    tags: ['qa'],
    responses: { 200: { description: 'Preset list' } },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface QaRequest {
  question: string;
  notebook_id: number;
  session_id?: number;
  preset?: string;
  directive?: 'Sources_only' | 'Knowledge_only' | 'Mixed';
  /** RAG strategy override. */
  strategy_id?: string;
  /** Retrieval top-K (default 5). */
  top_k?: number;
  /** Minimum similarity score (default 0.2). */
  min_score?: number;
  /** Scope retrieval to specific sources (v1 source_ids). */
  source_ids?: number[];
}

function loadHistory(
  sessionId: number,
): { role: 'user' | 'assistant' | 'system'; content: string }[] {
  const session = db().select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!session) throw new NotFoundError(`Session ${sessionId} not found`);

  const msgRows = db()
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.createdAt)
    .all();

  return msgRows.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));
}

/**
 * Auto-generate session title from the first question (v1 generate_session_title).
 * Only sets the title if the session title is currently empty/default.
 */
function maybeSetSessionTitle(sessionId: number, question: string): void {
  const session = db().select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!session) return;
  if (session.title && session.title.trim() && session.title !== 'New session') return;
  const cleaned = question.trim().replace(/\s+/g, ' ').slice(0, 80) || 'New session';
  db().update(sessions).set({ title: cleaned }).where(eq(sessions.id, sessionId)).run();
}

/**
 * c45: Parse /prompt:<preset> directive from question text (v1 presets.py:9-30).
 * Returns { preset, question } — preset extracted from leading /prompt:xxx.
 */
function parsePromptDirective(
  question: string,
  bodyPreset?: string,
): { preset: string; question: string } {
  // v1 presets.py:9-12: [a-z0-9_-]{1,32}, case-insensitive, lowercased
  const match = question.match(/^\/prompt:([a-z0-9_-]{1,32})\s+/i);
  if (match) {
    return { preset: match[1]!.toLowerCase(), question: question.slice(match[0].length) };
  }
  return { preset: (bodyPreset ?? 'default').toLowerCase(), question };
}

/** Validate notebook exists + optional session/source_ids ownership (v1 qa/api.py). */
function assertQaOwnership(opts: {
  notebookId: number;
  sessionId?: number;
  sourceIds?: number[];
}): void {
  const nb = db().select().from(notebooks).where(eq(notebooks.id, opts.notebookId)).get();
  if (!nb) throw new NotFoundError(`Notebook ${opts.notebookId} not found`);

  if (opts.sessionId !== undefined) {
    const session = db().select().from(sessions).where(eq(sessions.id, opts.sessionId)).get();
    if (!session || session.notebookId !== opts.notebookId) {
      throw new NotFoundError(`Session ${opts.sessionId} not found`);
    }
  }

  if (opts.sourceIds?.length) {
    const found = db()
      .select({ id: sources.id })
      .from(sources)
      .where(and(eq(sources.notebookId, opts.notebookId), inArray(sources.id, opts.sourceIds)))
      .all();
    if (found.length !== opts.sourceIds.length) {
      throw new Error('Unknown source_id in source_ids');
    }
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const qaRouter = new Elysia({ prefix: '/v2' })
  // List presets
  .get('/qa/presets', () => listPresets())

  // Non-streaming QA
  .post('/qa', async ({ body }) => {
    const {
      question: rawQuestion,
      notebook_id,
      session_id,
      preset: bodyPreset,
      directive,
      strategy_id,
      top_k,
      min_score,
      source_ids,
    } = body as unknown as QaRequest;

    // c45: parse /prompt:<preset> directive from question text (v1 presets.py:9-30)
    const { preset, question } = parsePromptDirective(rawQuestion, bodyPreset);

    assertQaOwnership({
      notebookId: notebook_id,
      sessionId: session_id,
      sourceIds: source_ids,
    });

    const history = session_id ? loadHistory(session_id) : [];

    // Create user message + auto-title
    if (session_id) {
      db()
        .insert(messages)
        .values({ sessionId: session_id, role: 'user', content: question })
        .run();
      maybeSetSessionTitle(session_id, question);
    }

    // Resolve model
    const modelConfig = getDefaultChatModel();
    if (!modelConfig) throw new Error('No chat model configured');
    const model = withRetry(await resolveModel(modelConfig));
    const systemPrompt = resolvePreset(preset, directive ?? 'Mixed');

    // Create provisional assistant message
    let messageId: number | undefined;
    if (session_id) {
      const msg = db()
        .insert(messages)
        .values({ sessionId: session_id, role: 'assistant', content: '' })
        .returning()
        .get();
      messageId = msg.id;
    }

    // H7: direct generate (no SSE re-parse) — uses generateText, not streamText
    const result = await generateQaDirect({
      model,
      question,
      notebookId: notebook_id,
      history,
      systemPrompt,
      messageId,
      strategyId: strategy_id,
      topK: top_k,
      minScore: min_score,
      sourceIds: source_ids,
      preset,
      onMessageSettled: (text, _failed, citations) => {
        if (messageId) {
          db()
            .update(messages)
            .set({ content: text, citations: citations ?? [] })
            .where(eq(messages.id, messageId))
            .run();
        }
      },
    });

    return {
      answer: result.answer,
      citations: result.citations,
      message_id: messageId ?? null,
      session_id,
      confidence: result.confidence,
      evidence: result.evidence,
      no_evidence_reason: result.noEvidenceReason,
    };
  })

  // Streaming QA
  .post('/qa/stream', async ({ body }) => {
    const {
      question: rawQuestion,
      notebook_id,
      session_id,
      preset: bodyPreset,
      directive,
      strategy_id,
      top_k,
      min_score,
      source_ids,
    } = body as unknown as QaRequest;

    // c45: parse /prompt:<preset> directive from question text
    const { preset, question } = parsePromptDirective(rawQuestion, bodyPreset);

    assertQaOwnership({
      notebookId: notebook_id,
      sessionId: session_id,
      sourceIds: source_ids,
    });

    const history = session_id ? loadHistory(session_id) : [];

    // Create user message + auto-title
    if (session_id) {
      db()
        .insert(messages)
        .values({ sessionId: session_id, role: 'user', content: question })
        .run();
      maybeSetSessionTitle(session_id, question);
    }

    const modelConfig = getDefaultChatModel();
    if (!modelConfig) throw new Error('No chat model configured');
    const model = withRetry(await resolveModel(modelConfig));
    const systemPrompt = resolvePreset(preset, directive ?? 'Mixed');

    // Create provisional assistant message
    let messageId: number | undefined;
    if (session_id) {
      const msg = db()
        .insert(messages)
        .values({ sessionId: session_id, role: 'assistant', content: '' })
        .returning()
        .get();
      messageId = msg.id;
    }

    return streamQa({
      model,
      question,
      notebookId: notebook_id,
      history,
      systemPrompt,
      messageId,
      strategyId: strategy_id,
      topK: top_k,
      minScore: min_score,
      sourceIds: source_ids,
      preset,
      onMessageSettled: (text, failed, citations) => {
        if (!messageId) return;
        if (failed || text.trim() === '') {
          db().delete(messages).where(eq(messages.id, messageId)).run();
        } else {
          db()
            .update(messages)
            .set({ content: text, citations: (citations ?? []) as unknown[] })
            .where(eq(messages.id, messageId))
            .run();
        }
      },
    });
  })

  // QA Export — markdown or json (v1 api.py:613-717)
  .get('/qa/export', ({ query }) => {
    const sessionId = Number(query.session_id);
    const messageId = query.message_id ? Number(query.message_id) : undefined;
    const format = (query.format as 'markdown' | 'json') ?? 'markdown';

    if (!sessionId) throw new Error('session_id is required');

    // Find the assistant message to export
    let assistantMessage;
    if (messageId) {
      assistantMessage = db().select().from(messages).where(eq(messages.id, messageId)).get();
      if (!assistantMessage || assistantMessage.sessionId !== sessionId) {
        throw new NotFoundError('Message not found');
      }
    } else {
      // Latest assistant message in the session
      assistantMessage = db()
        .select()
        .from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(messages.createdAt)
        .all()
        .filter((m) => m.role === 'assistant')
        .pop();
    }

    if (!assistantMessage) throw new NotFoundError('No assistant message found to export');

    // Find the preceding user question
    const precedingUser = db()
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.createdAt)
      .all()
      .filter((m) => m.role === 'user')
      .filter((m) => m.createdAt <= assistantMessage.createdAt)
      .pop();
    const question = precedingUser?.content ?? null;

    const citations = (assistantMessage.citations as unknown[] | null) ?? [];

    // c48: resolve notebook_id from session (v1 export is notebook-scoped,
    // api.py:669 filters sources by notebook_id) for sources meta + top-level.
    const sessionRow = db().select().from(sessions).where(eq(sessions.id, sessionId)).get();
    const notebookId = sessionRow?.notebookId;

    // c48: sources meta — v1 QAExportSource shape {source_id, source_name,
    // mime_type, parser_type}, notebook-scoped, with cited-but-deleted
    // fallback entries (v1 api.py:576-595 _build_sources_meta).
    const citedSourceIds = [
      ...new Set(
        citations
          .map((c) => (c as { source_id?: number }).source_id)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];
    const fallbackNames = new Map<number, string>();
    for (const c of citations) {
      const cit = c as { source_id?: number; source_name?: string };
      if (typeof cit.source_id === 'number')
        fallbackNames.set(cit.source_id, cit.source_name ?? '未知来源');
    }
    const sourceRows =
      citedSourceIds.length && notebookId !== undefined
        ? db()
            .select()
            .from(sources)
            .where(and(inArray(sources.id, citedSourceIds), eq(sources.notebookId, notebookId)))
            .all()
        : [];
    const foundIds = new Set(sourceRows.map((s) => s.id));
    const sourcesMeta = [
      // Existing sources (notebook-scoped)
      ...sourceRows.map((s) => ({
        source_id: s.id,
        source_name: s.filename,
        mime_type: s.mimeType,
        parser_type: s.parserType,
      })),
      // Fallback entries for cited-but-deleted sources (v1 api.py:584-595)
      ...citedSourceIds
        .filter((id) => !foundIds.has(id))
        .sort((a, b) => a - b)
        .map((id) => ({
          source_id: id,
          source_name: fallbackNames.get(id) ?? '未知来源',
          mime_type: null,
          parser_type: null,
        })),
    ];

    const exportedAt = new Date().toISOString();

    if (format === 'json') {
      // c48: JSON — add notebook_id (v1 api.py:679); sources meta in v1 shape.
      return {
        notebook_id: notebookId,
        session_id: sessionId,
        message_id: assistantMessage.id,
        question,
        answer: assistantMessage.content,
        citations,
        sources: sourcesMeta,
        exported_at: exportedAt,
      };
    }

    // c48: markdown citation line — v1 _format_citation_line (api.py:599-610):
    // [i] name · chunk N · page N · para N + blockquote snippet.
    const citationLines = citations.map((c, i) => {
      const cit = c as {
        source_name?: string;
        chunk_index?: number;
        page_number?: number | null;
        paragraph_index?: number | null;
        snippet?: string;
      };
      const parts = [`[${i + 1}] ${cit.source_name ?? 'unknown'}`];
      if (typeof cit.chunk_index === 'number') parts.push(`chunk ${cit.chunk_index}`);
      if (cit.page_number !== null && cit.page_number !== undefined)
        parts.push(`page ${cit.page_number}`);
      if (cit.paragraph_index !== null && cit.paragraph_index !== undefined)
        parts.push(`para ${cit.paragraph_index}`);
      const prefix = parts.join(' · ');
      const snippet = cit.snippet?.trim();
      return snippet ? `${prefix}\n> ${snippet}` : prefix;
    });
    const citationsBlock = citationLines.length ? citationLines.join('\n\n') : '无引用';

    // c48: add `- Notebook ID:` line (v1 api.py:698).
    const markdown = [
      `# QA Export #${assistantMessage.id}`,
      '',
      `- Notebook ID: ${notebookId ?? '?'}`,
      `- Session ID: ${sessionId}`,
      `- Message ID: ${assistantMessage.id}`,
      `- Exported At: ${exportedAt}`,
      '',
      '## Question',
      question ?? '(unknown)',
      '',
      '## Answer',
      assistantMessage.content,
      '',
      '## Citations',
      citationsBlock,
    ].join('\n');

    return new Response(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="qa-export-${assistantMessage.id}.md"`,
      },
    });
  });

registerApiDoc(apiDocs);
