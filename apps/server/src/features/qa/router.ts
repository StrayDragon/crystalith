import { QaAnswerSchema, QaExportQuerySchema, QaRequestSchema } from '@crystalith/shared';
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
import { resolvePreset, listPresets, parsePromptDirective } from './presets.ts';

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
  const cleaned = question.trim().replaceAll(/\s+/gu, ' ').slice(0, 80) || 'New session';
  db().update(sessions).set({ title: cleaned }).where(eq(sessions.id, sessionId)).run();
}

/** Validate notebook exists + optional session/sourceIds ownership (v1 qa/api.py). */
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
      throw new Error('Unknown source_id in sourceIds');
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
  .post(
    '/qa',
    async ({ body }) => {
      const {
        question: rawQuestion,
        content: rawContent,
        notebookId,
        sessionId,
        preset: bodyPreset,
        directive,
        strategyId,
        topK,
        minScore,
        sourceIds,
      } = body;

      // c45: parse /prompt:<preset> directive from question text (v1 presets.py:9-30)
      // Accept both 'question' (API canonical) and 'content' (some clients' convention)
      const resolvedQuestion = (rawQuestion ?? rawContent)!;
      const { preset, question } = parsePromptDirective(resolvedQuestion, bodyPreset);

      assertQaOwnership({
        notebookId,
        sessionId,
        sourceIds,
      });

      const history = sessionId ? loadHistory(sessionId) : [];

      // Create user message + auto-title
      if (sessionId) {
        db()
          .insert(messages)
          .values({ sessionId: sessionId, role: 'user', content: question })
          .run();
        maybeSetSessionTitle(sessionId, question);
      }

      // Resolve model
      const modelConfig = getDefaultChatModel();
      if (!modelConfig) throw new Error('No chat model configured');
      const model = withRetry(await resolveModel(modelConfig));
      const systemPrompt = resolvePreset(preset, directive ?? 'Mixed');

      // Create provisional assistant message
      let messageId: number | undefined;
      if (sessionId) {
        const msg = db()
          .insert(messages)
          .values({ sessionId: sessionId, role: 'assistant', content: '' })
          .returning()
          .get();
        messageId = msg.id;
      }

      // H7: direct generate (no SSE re-parse) — uses generateText, not streamText
      const result = await generateQaDirect({
        model,
        question,
        notebookId: notebookId,
        history,
        systemPrompt,
        messageId,
        strategyId: strategyId,
        topK: topK,
        minScore: minScore,
        sourceIds: sourceIds,
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
        messageId: messageId ?? null,
        sessionId,
        confidence: result.confidence,
        evidence: result.evidence,
        noEvidenceReason: result.noEvidenceReason,
      };
    },
    { body: QaRequestSchema, response: { 200: QaAnswerSchema } },
  )

  // Streaming QA
  .post(
    '/qa/stream',
    async ({ body }) => {
      const {
        question: rawQuestion,
        content: rawContent,
        notebookId,
        sessionId,
        preset: bodyPreset,
        directive,
        strategyId,
        topK,
        minScore,
        sourceIds,
      } = body;

      // Accept both 'question' (API canonical) and 'content' (parity with /v2/qa)
      const resolvedQuestion = (rawQuestion ?? rawContent)!;

      // c45: parse /prompt:<preset> directive from question text
      const { preset, question } = parsePromptDirective(resolvedQuestion, bodyPreset);

      assertQaOwnership({
        notebookId: notebookId,
        sessionId: sessionId,
        sourceIds: sourceIds,
      });

      const history = sessionId ? loadHistory(sessionId) : [];

      // Create user message + auto-title
      if (sessionId) {
        db()
          .insert(messages)
          .values({ sessionId: sessionId, role: 'user', content: question })
          .run();
        maybeSetSessionTitle(sessionId, question);
      }

      const modelConfig = getDefaultChatModel();
      if (!modelConfig) throw new Error('No chat model configured');
      const model = withRetry(await resolveModel(modelConfig));
      const systemPrompt = resolvePreset(preset, directive ?? 'Mixed');

      // Create provisional assistant message
      let messageId: number | undefined;
      if (sessionId) {
        const msg = db()
          .insert(messages)
          .values({ sessionId: sessionId, role: 'assistant', content: '' })
          .returning()
          .get();
        messageId = msg.id;
      }

      return streamQa({
        model,
        question,
        notebookId: notebookId,
        history,
        systemPrompt,
        messageId,
        strategyId: strategyId,
        topK: topK,
        minScore: minScore,
        sourceIds: sourceIds,
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
    },
    { body: QaRequestSchema },
  )

  // QA Export — markdown or json (v1 api.py:613-717)
  .get(
    '/qa/export',
    ({ query }) => {
      const sessionId = query.sessionId;
      const messageId = query.messageId;
      const format = query.format;

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
          .find((m) => m.role === 'assistant');
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
        .find((m) => m.createdAt <= assistantMessage.createdAt);
      const question = precedingUser?.content ?? null;

      const citations = (assistantMessage.citations as unknown[] | null) ?? [];

      // c48: resolve notebookId from session (v1 export is notebook-scoped,
      // api.py:669 filters sources by notebookId) for sources meta + top-level.
      const sessionRow = db().select().from(sessions).where(eq(sessions.id, sessionId)).get();
      const notebookId = sessionRow?.notebookId;

      // c48: sources meta — v1 QAExportSource shape {source_id, source_name,
      // mime_type, parser_type}, notebook-scoped, with cited-but-deleted
      // fallback entries (v1 api.py:576-595 _build_sources_meta).
      const citedSourceIds = [
        ...new Set(
          citations
            .map((c) => (c as { sourceId?: number }).sourceId)
            .filter((id): id is number => typeof id === 'number'),
        ),
      ];
      const fallbackNames = new Map<number, string>();
      for (const c of citations) {
        const cit = c as { sourceId?: number; sourceName?: string };
        if (typeof cit.sourceId === 'number')
          fallbackNames.set(cit.sourceId, cit.sourceName ?? '未知来源');
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
          sourceId: s.id,
          sourceName: s.filename,
          mimeType: s.mimeType,
          parserType: s.parserType,
        })),
        // Fallback entries for cited-but-deleted sources (v1 api.py:584-595)
        ...citedSourceIds
          .filter((id) => !foundIds.has(id))
          .toSorted((a, b) => a - b)
          .map((id) => ({
            sourceId: id,
            sourceName: fallbackNames.get(id) ?? '未知来源',
            mimeType: null,
            parserType: null,
          })),
      ];

      const exportedAt = new Date().toISOString();

      if (format === 'json') {
        // c48: JSON — add notebookId (v1 api.py:679); sources meta in v1 shape.
        return {
          notebookId: notebookId,
          sessionId: sessionId,
          messageId: assistantMessage.id,
          question,
          answer: assistantMessage.content,
          citations,
          sources: sourcesMeta,
          exportedAt,
        };
      }

      // c48: markdown citation line — v1 _format_citation_line (api.py:599-610):
      // [i] name · chunk N · page N · para N + blockquote snippet.
      const citationLines = citations.map((c, i) => {
        const cit = c as {
          sourceName?: string;
          chunkIndex?: number;
          pageNumber?: number | null;
          paragraphIndex?: number | null;
          snippet?: string;
        };
        const parts = [`[${i + 1}] ${cit.sourceName ?? 'unknown'}`];
        if (typeof cit.chunkIndex === 'number') parts.push(`chunk ${cit.chunkIndex}`);
        if (cit.pageNumber !== null && cit.pageNumber !== undefined)
          parts.push(`page ${cit.pageNumber}`);
        if (cit.paragraphIndex !== null && cit.paragraphIndex !== undefined)
          parts.push(`para ${cit.paragraphIndex}`);
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
    },
    { query: QaExportQuerySchema },
  );

registerApiDoc(apiDocs);
