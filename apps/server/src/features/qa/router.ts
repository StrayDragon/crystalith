// QA router — /v2/qa (non-streaming), /v2/qa/stream (SSE)
//
// Mirrors v1 `features/qa/api.py` on Elysia + AI SDK streamText.
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { messages, sessions } from '../../db/schema.ts';
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

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const qaRouter = new Elysia({ prefix: '/v2' })
  // List presets
  .get('/qa/presets', () => listPresets())

  // Non-streaming QA
  .post('/qa', async ({ body }) => {
    const { question, notebook_id, session_id, preset, directive } = body as unknown as QaRequest;

    // Load session history
    const history = session_id ? loadHistory(session_id) : [];

    // Create user message
    if (session_id) {
      db()
        .insert(messages)
        .values({ sessionId: session_id, role: 'user', content: question })
        .run();
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

    const response = streamQa({
      model,
      question,
      notebookId: notebook_id,
      history,
      systemPrompt,
      messageId,
    });

    // Read full SSE stream and extract final answer
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    const citations: unknown[] = [];
    let finalMessageId: number | null = null;

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
              if (data.citations || data.message_id !== undefined) {
                finalMessageId = data.message_id ?? null;
                for (const c of data.citations ?? []) citations.push(c);
              }
            } catch {
              /* skip non-JSON */
            }
          }
        }
      }
    }

    // Persist assistant message content
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
    };
  })

  // Streaming QA
  .post('/qa/stream', async ({ body }) => {
    const { question, notebook_id, session_id, preset, directive } = body as unknown as QaRequest;

    const history = session_id ? loadHistory(session_id) : [];

    // Create user message
    if (session_id) {
      db()
        .insert(messages)
        .values({ sessionId: session_id, role: 'user', content: question })
        .run();
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
    });
  });

registerApiDoc(apiDocs);
