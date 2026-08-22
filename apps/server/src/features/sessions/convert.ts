import {
  SessionConvertToOutputRequestSchema,
  SessionConvertToSourceRequestSchema,
} from '@crystalith/shared';
// Session conversion service — convert-to-source / convert-to-output (c34/c52).
//
// Extracted from router.ts to keep the HTTP layer thin; both conversions share
// `loadSessionMessages`, collapsing the duplicated message_ids filter block.
import { eq } from 'drizzle-orm';
import { NotFoundError } from 'elysia';
import type { z } from 'zod';

import { db } from '../../db/index.ts';
import { chunks, messages, outputs, sessions, sources } from '../../db/schema.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { requireOwnedRow } from '../../shared/notebook-scope.ts';

type ConvertToSourceBody = z.infer<typeof SessionConvertToSourceRequestSchema>;
type ConvertToOutputBody = z.infer<typeof SessionConvertToOutputRequestSchema>;

/**
 * Load a session's messages in chronological order, optionally filtered by
 * messageIds. 404 when any requested id is missing or nothing remains
 * (v1 api.py:262-268 / api.py:417-428).
 */
function loadSessionMessages(sid: number, messageIds?: number[]) {
  let msgRows = db()
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sid))
    .orderBy(messages.createdAt)
    .all();
  if (messageIds && messageIds.length > 0) {
    const wanted = new Set(messageIds);
    const missing = messageIds.filter((id) => !msgRows.some((m) => m.id === id));
    if (missing.length > 0) {
      throw new NotFoundError(`Message(s) not found in session: ${missing.join(', ')}`);
    }
    msgRows = msgRows.filter((m) => wanted.has(m.id));
  }
  if (msgRows.length === 0) {
    throw new NotFoundError('No messages found in session');
  }
  return msgRows;
}

/** Chunk ids referenced by message citations, deduplicated (v1 api.py:491-500, c39). */
function citationChunkIds(citations: unknown[] | null | undefined): number[] {
  if (!citations) return [];
  const ids: number[] = [];
  for (const citation of citations) {
    if (
      typeof citation === 'object' &&
      citation !== null &&
      'chunkId' in citation &&
      typeof citation.chunkId === 'number'
    ) {
      ids.push(citation.chunkId);
    }
  }
  return ids;
}

/** Convert session messages into a markdown source; chunk + embed + vectorize (c34/c39). */
export async function convertSessionToSource(
  nid: number,
  sid: number,
  body: ConvertToSourceBody,
): Promise<{ sourceId: number; filename: string; chunkCount: number; messageCount: number }> {
  const sessionRow = requireOwnedRow(sessions, sid, nid, 'Session');
  const msgRows = loadSessionMessages(sid, body.messageIds);

  // c52: v1 text format (api.py:110-123) — Chinese role labels + \n\n join.
  const text = msgRows
    .map((m) => {
      const role = m.role === 'assistant' ? '助手' : '用户';
      return `**${role}**: ${m.content}`;
    })
    .join('\n\n');

  const title = sessionRow.title ?? `会话_${sid}`;
  const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, '-');
  const filename = `对话_${title}_${timestamp}.md`;

  // Create source
  const source = db()
    .insert(sources)
    .values({
      notebookId: nid,
      filename,
      status: 'processing',
      metadata: {
        convertedFromSession: sid,
        conversionTimestamp: new Date().toISOString(),
        messageCount: msgRows.length,
      },
    })
    .returning()
    .get();

  // Chunk the conversation text
  const { chunkText } = await import('../../rag/chunker.ts');
  const reportChunks = chunkText(text);

  // Insert chunks
  const chunkRows: Array<{ id: number; text: string }> = [];
  for (const chunk of reportChunks) {
    const chunkRow = db()
      .insert(chunks)
      .values({
        sourceId: source.id,
        chunkIndex: chunk.index,
        text: chunk.text,
        metadata: { source_type: 'session_conversion' },
      })
      .returning()
      .get();
    chunkRows.push({ id: chunkRow.id, text: chunk.text });
  }

  // Embed and store vectors
  if (chunkRows.length > 0) {
    try {
      const { embedBatch } = await import('../../rag/embedder.ts');
      const { insertChunkVector } = await import('../../db/vectors.ts');
      const vectors = await embedBatch(chunkRows.map((c) => c.text));

      for (const [i, vec] of vectors.entries()) {
        insertChunkVector(db(), chunkRows[i].id, nid, source.id, vec);
      }

      const { bumpVectorEpoch, bumpSourcesEpoch } = await import('../../rag/cache.ts');
      bumpVectorEpoch(nid);
      bumpSourcesEpoch(nid);
      // Only set ready after successful embedding (c39: fix ready-before-vectors race)
      db().update(sources).set({ status: 'ready' }).where(eq(sources.id, source.id)).run();
    } catch (error) {
      console.error('[sessions] convert embedding failed:', error);
      db()
        .update(sources)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Embedding failed',
        })
        .where(eq(sources.id, source.id))
        .run();
      throw new AppHttpError(ErrorCode.INTERNAL_ERROR, 'Failed to embed session source', {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    db().update(sources).set({ status: 'ready' }).where(eq(sources.id, source.id)).run();
  }

  return {
    sourceId: source.id,
    filename,
    chunkCount: chunkRows.length,
    messageCount: msgRows.length,
  };
}

/** Organize session messages into an output (PARAGRAPH / BULLETS / STRUCTURED) (c34/c39/c52). */
export function convertSessionToOutput(
  nid: number,
  sid: number,
  body: ConvertToOutputBody,
): {
  outputId: number;
  outputType: ConvertToOutputBody['outputType'];
  title: string;
  messageCount: number;
} {
  const sessionRow = requireOwnedRow(sessions, sid, nid, 'Session');
  const msgRows = loadSessionMessages(sid, body.messageIds);
  const { outputType } = body;

  // c52: v1 text format (api.py:438 text_format="raw") — plain content, no
  // role prefix. Was: [Assistant]/[User] prefixed per line.
  const textContent = msgRows.map((m) => m.content).join('\n');

  const title = sessionRow.title ?? `会话_${sid}`;

  // Build output content per type
  let content: Record<string, unknown>;
  if (outputType === 'BULLETS') {
    const lines = textContent
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 50);
    content = {
      title: `${title} - 要点笔记`,
      bullets: lines,
      _metadata: {
        convertedFromSession: sid,
        messageCount: msgRows.length,
      },
    };
  } else if (outputType === 'STRUCTURED') {
    content = {
      title: `${title} - 结构化笔记`,
      sections: [{ title: '对话内容', content: textContent }],
      _metadata: {
        convertedFromSession: sid,
        messageCount: msgRows.length,
      },
    };
  } else {
    content = {
      title: `${title} - 段落笔记`,
      text: textContent,
      _metadata: {
        convertedFromSession: sid,
        messageCount: msgRows.length,
      },
    };
  }

  // Collect chunk_ids from message citations (v1 api.py:491-500, c39)
  const chunkIds = [...new Set(msgRows.flatMap((m) => citationChunkIds(m.citations)))];

  const output = db()
    .insert(outputs)
    .values({
      notebookId: nid,
      type: outputType,
      prompt: `Session conversion: ${title}`,
      chunkIds,
      content,
    })
    .returning()
    .get();

  return {
    outputId: output.id,
    outputType,
    title: typeof content.title === 'string' ? content.title : title,
    messageCount: msgRows.length,
  };
}
