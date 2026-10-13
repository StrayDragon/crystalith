import {
  QaAnswerSchema,
  QaExportJsonResponseSchema,
  QaExportQuerySchema,
  QaNestedRequestSchema,
  CitationSchema,
  type QaNestedRequest,
} from '@crystalith/shared';
// QA router — nested canonical (c69/c90).
//
// Canonical: /v2/notebooks/:nid/qa{,/stream,/export}
// (c90: flat /v2/qa* aliases removed)
// Mirrors v1 `features/qa/api.py` on Elysia + AI SDK streamText.
// c36: deterministic retrieval (retrieveAndJudge) + evidence short-circuit.
import { and, eq, inArray } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { client, db } from '../../db/index.ts';
import { messages, sessions, sources } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { formatCitationBlock } from '../../shared/citations.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { PathId } from '../../shared/ids.ts';
import { resolveNestedNotebookId, requireNotebook } from '../../shared/notebook-scope.ts';
import { streamQa, generateQaDirect } from './handler.ts';
import {
  applyQaControls,
  detectBarePromptDirective,
  listAllPresetNames,
  parsePromptDirective,
  renderSystemPrompt,
  resolveQaPreset,
} from './presets.ts';

/** JSON export is Zod-validated; markdown download is a raw Response. */
const QaExportResponseSchema = z.union([
  QaExportJsonResponseSchema,
  z.custom<Response>((value) => value instanceof Response),
]);

// ---------------------------------------------------------------------------
// OpenAPI docs
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks/:nid/qa',
    method: 'post',
    summary: '笔记本问答（一次性返回）；可指定 session、来源范围与检索策略',
    tags: ['qa'],
    request: { body: QaNestedRequestSchema },
    responses: { 200: { description: '问答结果' } },
  },
  {
    path: '/v2/notebooks/:nid/qa/stream',
    method: 'post',
    summary: '笔记本问答（SSE 流式）；可指定 session、来源范围与检索策略',
    tags: ['qa'],
    request: { body: QaNestedRequestSchema },
    responses: { 200: { description: 'SSE 流', contentType: 'text/event-stream' } },
  },
  {
    path: '/v2/notebooks/:nid/qa/export',
    method: 'get',
    summary: '导出问答结果为 markdown 或 json',
    tags: ['qa'],
    responses: { 200: { description: '导出内容' } },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadHistory(
  sessionId: number,
): Promise<{ role: 'user' | 'assistant' | 'system'; content: string }[]> {
  const session = await client().get(
    db().select().from(sessions).where(eq(sessions.id, sessionId)),
  );
  if (!session) throw new NotFoundError(`Session ${sessionId} not found`);

  const msgRows = await client().all(
    db()
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.createdAt),
  );

  return msgRows.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

/**
 * Auto-generate session title from the first question (v1 generate_session_title).
 * Only sets the title if the session title is currently empty/default.
 */
async function maybeSetSessionTitle(sessionId: number, question: string): Promise<void> {
  const session = await client().get(
    db().select().from(sessions).where(eq(sessions.id, sessionId)),
  );
  if (!session) return;
  if (session.title && session.title.trim() && session.title !== 'New session') return;
  const cleaned = question.trim().replaceAll(/\s+/gu, ' ').slice(0, 80) || 'New session';
  await client().run(
    db().update(sessions).set({ title: cleaned }).where(eq(sessions.id, sessionId)),
  );
}

/** Validate notebook exists + optional session/sourceIds ownership (v1 qa/api.py). */
async function assertQaOwnership(opts: {
  notebookId: number;
  sessionId?: number;
  sourceIds?: number[];
}): Promise<void> {
  await requireNotebook(opts.notebookId);

  if (opts.sessionId !== undefined) {
    const session = await client().get(
      db().select().from(sessions).where(eq(sessions.id, opts.sessionId)),
    );
    if (!session || session.notebookId !== opts.notebookId) {
      throw new NotFoundError(`Session ${opts.sessionId} not found`);
    }
  }

  if (opts.sourceIds?.length) {
    const found = await client().all(
      db()
        .select({ id: sources.id })
        .from(sources)
        .where(and(eq(sources.notebookId, opts.notebookId), inArray(sources.id, opts.sourceIds))),
    );
    if (found.length !== opts.sourceIds.length) {
      throw new AppHttpError(ErrorCode.NOT_FOUND, 'Unknown source_id in sourceIds');
    }
  }
}

type QaBody = QaNestedRequest & { notebookId: number };

/**
 * Shared QA prelude for /qa and /qa/stream:
 * generation-type check → bare-directive check → directive parse → preset
 * whitelist resolution → ownership check → history → user message + auto-title →
 * model resolve → provisional assistant placeholder.
 * Call sites only differ in the generator invocation and onMessageSettled policy.
 */
async function prepareQa(body: QaBody) {
  const {
    question: rawQuestion,
    content: rawContent,
    notebookId,
    sessionId,
    preset: bodyPreset,
    directive,
    sourceIds,
    generationTypeId,
    controls,
  } = body;

  // r324: this surface only serves its owning generation type.
  if (generationTypeId !== 'qa') {
    throw new AppHttpError(
      ErrorCode.INVALID_REQUEST,
      `Generation type '${generationTypeId}' is not served by the QA endpoint`,
      { expected: 'qa', got: generationTypeId },
    );
  }

  // c45: parse /prompt:<preset> directive from question text (v1 presets.py:9-30)
  // Accept both 'question' (API canonical) and 'content' (some clients' convention)
  const resolvedQuestion = (rawQuestion ?? rawContent)!;

  // r422: bare `/prompt:<name>` (no query text) is a deterministic input error.
  const bareDirective = detectBarePromptDirective(resolvedQuestion);
  if (bareDirective) {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'Missing query after /prompt directive', {
      usage: '/prompt:<preset> <query>',
      presetId: bareDirective,
      availablePresets: await listAllPresetNames(),
    });
  }

  const { preset, question } = parsePromptDirective(resolvedQuestion, bodyPreset);

  // r23/r24/r25: whitelist resolution across built-in + custom, enabled-checked.
  const resolution = await resolveQaPreset(preset);
  const directed = renderSystemPrompt(resolution.systemPromptTemplate, directive ?? 'Mixed');
  // r186/r189: structured constraint overrides → prompt instructions + echo.
  const { systemPrompt: directedWithControls, effectiveControls } = applyQaControls(
    directed,
    controls,
  );

  assertQaOwnership({ notebookId, sessionId, sourceIds });

  const history = sessionId ? await loadHistory(sessionId) : [];

  // Create user message + auto-title
  if (sessionId) {
    await client().run(
      db().insert(messages).values({ sessionId: sessionId, role: 'user', content: question }),
    );
    maybeSetSessionTitle(sessionId, question);
  }

  const modelConfig = getDefaultChatModel();
  if (!modelConfig) throw new AppHttpError(ErrorCode.MODEL_UNAVAILABLE, 'No chat model configured');
  const model = withRetry(await resolveModel(modelConfig));
  const systemPrompt = directedWithControls;

  // Create provisional assistant message
  let messageId: number | undefined;
  if (sessionId) {
    const msg = (await client().get(
      db()
        .insert(messages)
        .values({ sessionId: sessionId, role: 'assistant', content: '' })
        .returning(),
    ))!;
    messageId = msg.id;
  }

  return {
    model,
    question,
    notebookId,
    sessionId,
    history,
    systemPrompt,
    messageId,
    preset: resolution.presetId,
    effectiveControls,
    generationBase: {
      generationTypeId: 'qa',
      outputType: 'MESSAGE',
      presetId: resolution.presetId,
      effectiveControls,
    } as const,
  };
}

async function handleQaPost(body: QaBody) {
  const prepared = await prepareQa(body);

  // H7: direct generate (no SSE re-parse) — uses generateText, not streamText
  const result = await generateQaDirect({
    ...prepared,
    strategyId: body.strategyId,
    topK: body.topK,
    minScore: body.minScore,
    sourceIds: body.sourceIds,
    onMessageSettled: async (text, _failed, citations) => {
      if (prepared.messageId) {
        await client().run(
          db()
            .update(messages)
            .set({ content: text, citations: citations ?? [] })
            .where(eq(messages.id, prepared.messageId)),
        );
      }
    },
  });

  return {
    answer: result.answer,
    citations: result.citations,
    messageId: prepared.messageId ?? null,
    sessionId: prepared.sessionId,
    confidence: result.confidence,
    evidence: result.evidence,
    noEvidenceReason: result.noEvidenceReason,
    // r326: generation metadata echo on the result object.
    generation: { ...prepared.generationBase, completion: 'answer' },
  };
}

async function handleQaStream(body: QaBody) {
  const prepared = await prepareQa(body);

  return streamQa({
    ...prepared,
    strategyId: body.strategyId,
    topK: body.topK,
    minScore: body.minScore,
    sourceIds: body.sourceIds,
    // r326: streamed results echo generation metadata on the done event.
    generation: { ...prepared.generationBase, completion: 'streamed-answer' },
    onMessageSettled: async (text, failed, citations) => {
      const { messageId } = prepared;
      if (!messageId) return;
      if (failed || text.trim() === '') {
        await client().run(db().delete(messages).where(eq(messages.id, messageId)));
      } else {
        await client().run(
          db()
            .update(messages)
            .set({ content: text, citations: citations ?? [] })
            .where(eq(messages.id, messageId)),
        );
      }
    },
  });
}

type QaExportQuery = {
  sessionId: number;
  messageId?: number;
  format: 'markdown' | 'json';
};

/** Export QA answer; session must belong to `pathNotebookId`. */
async function handleQaExport(query: QaExportQuery, pathNotebookId: number) {
  const sessionId = query.sessionId;
  const messageId = query.messageId;
  const format = query.format;

  const sessionRow = await client().get(
    db().select().from(sessions).where(eq(sessions.id, sessionId)),
  );
  if (!sessionRow || sessionRow.notebookId !== pathNotebookId) {
    throw new NotFoundError('Session not found');
  }

  // Find the assistant message to export
  let assistantMessage;
  if (messageId) {
    assistantMessage = await client().get(
      db().select().from(messages).where(eq(messages.id, messageId)),
    );
    if (!assistantMessage || assistantMessage.sessionId !== sessionId) {
      throw new NotFoundError('Message not found');
    }
  } else {
    // Latest assistant message in the session
    assistantMessage = (
      await client().all(
        db()
          .select()
          .from(messages)
          .where(eq(messages.sessionId, sessionId))
          .orderBy(messages.createdAt),
      )
    ).find((m) => m.role === 'assistant');
  }

  if (!assistantMessage) throw new NotFoundError('No assistant message found to export');

  // Find the preceding user question
  const precedingUser = (
    await client().all(
      db()
        .select()
        .from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(messages.createdAt),
    )
  )
    .filter((m) => m.role === 'user')
    .find((m) => m.createdAt <= assistantMessage.createdAt);
  const question = precedingUser?.content ?? null;

  const citations = CitationSchema.array()
    .catch([])
    .parse(assistantMessage.citations ?? []);

  // c48: resolve notebookId from session (v1 export is notebook-scoped,
  // api.py:669 filters sources by notebookId) for sources meta + top-level.
  const notebookId = sessionRow.notebookId;

  // c48: sources meta — v1 QAExportSource shape {source_id, source_name,
  // mime_type, parser_type}, notebook-scoped, with cited-but-deleted
  // fallback entries (v1 api.py:576-595 _build_sources_meta).
  const citedSourceIds = [
    ...new Set(
      citations.map((c) => c.sourceId).filter((id): id is number => typeof id === 'number'),
    ),
  ];
  const fallbackNames = new Map<number, string>();
  for (const c of citations) {
    if (typeof c.sourceId === 'number') fallbackNames.set(c.sourceId, c.sourceName ?? '未知来源');
  }
  const sourceRows =
    citedSourceIds.length && notebookId !== undefined
      ? await client().all(
          db()
            .select()
            .from(sources)
            .where(and(inArray(sources.id, citedSourceIds), eq(sources.notebookId, notebookId))),
        )
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

  // c48: markdown citation block (shared formatter; v1 _format_citation_line).
  const citationsBlock = formatCitationBlock(citations);

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
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const qaRouter = new Elysia({ prefix: '/v2' })
  // Presets route removed (c73): FE uses /v2/workspace/tools instead

  // ---- Nested canonical ----
  .post(
    '/notebooks/:nid/qa',
    async ({ params, body }) => {
      const nid = params.nid;
      const notebookId = resolveNestedNotebookId(nid, body.notebookId);
      return handleQaPost({ ...body, notebookId });
    },
    {
      params: z.object({ nid: PathId }),
      body: QaNestedRequestSchema,
      response: { 200: QaAnswerSchema },
    },
  )
  .post(
    '/notebooks/:nid/qa/stream',
    async ({ params, body }) => {
      const nid = params.nid;
      const notebookId = resolveNestedNotebookId(nid, body.notebookId);
      return handleQaStream({ ...body, notebookId });
    },
    { params: z.object({ nid: PathId }), body: QaNestedRequestSchema },
  )
  .get(
    '/notebooks/:nid/qa/export',
    ({ params, query }) => {
      const nid = params.nid;
      return handleQaExport(query, nid);
    },
    {
      params: z.object({ nid: PathId }),
      query: QaExportQuerySchema,
      response: QaExportResponseSchema,
    },
  );

registerApiDoc(apiDocs);
