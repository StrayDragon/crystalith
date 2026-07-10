// QA router — /v2/qa (non-streaming), /v2/qa/stream (SSE), /v2/qa/export
//
// Mirrors v1 `features/qa/api.py` on Elysia + AI SDK streamText.
// c36: deterministic retrieval (retrieveAndJudge) + evidence short-circuit.
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { messages, sessions, sources } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { streamQa } from './handler.ts';
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

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const qaRouter = new Elysia({ prefix: '/v2' })
  // List presets
  .get('/qa/presets', () => listPresets())

  // Non-streaming QA
  .post('/qa', async ({ body }) => {
    const {
      question,
      notebook_id,
      session_id,
      preset,
      directive,
      strategy_id,
      top_k,
      min_score,
      source_ids,
    } = body as unknown as QaRequest;

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
    const systemPrompt = resolvePreset(preset ?? 'default', directive ?? 'Mixed');

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

    const response = await streamQa({
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
    });

    // Read full SSE stream and extract final answer + metadata
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    const citations: unknown[] = [];
    let finalMessageId: number | null = null;
    let confidence: number | undefined;
    let evidence: boolean | undefined;
    let noEvidenceReason: string | undefined;

    let done = false;
    while (!done) {
      const { value, done: isDone } = await reader.read();
      done = isDone;
      if (value) {
        const text = decoder.decode(value, { stream: !isDone });
        for (const line of text.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) fullText += data.text ?? '';
              if (data.message_id !== undefined) {
                finalMessageId = data.message_id ?? null;
              }
              if (data.citations) {
                for (const c of data.citations) citations.push(c);
              }
              if (data.confidence !== undefined) confidence = data.confidence;
              if (data.evidence !== undefined) evidence = data.evidence;
              if (data.no_evidence_reason !== undefined) noEvidenceReason = data.no_evidence_reason;
            } catch {
              /* skip non-JSON */
            }
          }
        }
      }
    }

    // Persist assistant message content + citations
    if (finalMessageId) {
      db()
        .update(messages)
        .set({ content: fullText, citations: citations as unknown[] })
        .where(eq(messages.id, finalMessageId))
        .run();
    }

    return {
      answer: fullText,
      citations,
      message_id: finalMessageId,
      session_id,
      confidence,
      evidence,
      no_evidence_reason: noEvidenceReason,
    };
  })

  // Streaming QA
  .post('/qa/stream', async ({ body }) => {
    const {
      question,
      notebook_id,
      session_id,
      preset,
      directive,
      strategy_id,
      top_k,
      min_score,
      source_ids,
    } = body as unknown as QaRequest;

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
    const systemPrompt = resolvePreset(preset ?? 'default', directive ?? 'Mixed');

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
      onMessageSettled: (text, failed) => {
        if (!messageId) return;
        if (failed || text.trim() === '') {
          db().delete(messages).where(eq(messages.id, messageId)).run();
        } else {
          db().update(messages).set({ content: text }).where(eq(messages.id, messageId)).run();
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
      assistantMessage = db()
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .get();
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

    // Build sources metadata
    const sourceIds = [
      ...new Set(
        citations
          .map((c) => (c as { source_id?: number }).source_id)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];
    const sourceRows = sourceIds.length
      ? db().select().from(sources).where(eq(sources.id, sourceIds[0])).all() // simplified
      : [];
    const sourcesMeta = sourceRows.map((s) => ({
      id: s.id,
      filename: s.filename,
      status: s.status,
    }));

    const exportedAt = new Date().toISOString();

    if (format === 'json') {
      return {
        session_id: sessionId,
        message_id: assistantMessage.id,
        question,
        answer: assistantMessage.content,
        citations,
        sources: sourcesMeta,
        exported_at: exportedAt,
      };
    }

    // Markdown format (v1 _format_citation_line + 3-section structure)
    const citationLines = citations.map((c, i) => {
      const cit = c as { source_name?: string; chunk_index?: number; snippet?: string };
      const parts = [`[${i + 1}] ${cit.source_name ?? 'unknown'}`];
      if (typeof cit.chunk_index === 'number') parts.push(`chunk ${cit.chunk_index}`);
      const prefix = parts.join(' · ');
      const snippet = cit.snippet?.trim();
      return snippet ? `${prefix}\n> ${snippet}` : prefix;
    });
    const citationsBlock = citationLines.length ? citationLines.join('\n\n') : '无引用';

    const markdown = [
      `# QA Export #${assistantMessage.id}`,
      '',
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
