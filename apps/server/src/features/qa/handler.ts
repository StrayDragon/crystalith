import type { LanguageModelV4 } from '@ai-sdk/provider';
import type { Citation, ChatTurn } from '@crystalith/shared';
// QA handler — streamText + retrieveSources tool integration.
//
// Wraps AI SDK streamText with RAG tool calling. The agent autonomously
// decides when to call retrieveSources based on the user's question.
import { tool } from 'ai';
import { z } from 'zod';

import { streamQaResponse } from '../../ai/stream.ts';
import { EmbedStrategy } from '../../rag/embed-strategy.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QaHandlerOptions {
  model: LanguageModelV4;
  question: string;
  notebookId: number;
  history: ChatTurn[];
  systemPrompt: string;
  messageId?: number;
  maxSteps?: number;
}

// ---------------------------------------------------------------------------
// retrieveSources tool
// ---------------------------------------------------------------------------

const embedStrategy = new EmbedStrategy();

const retrieveSourcesTool = (notebookId: number) =>
  tool({
    description:
      'Retrieve relevant source chunks from the notebook to answer the user question. Call this before answering.',
    inputSchema: z.object({
      query: z.string().describe('Search query to find relevant information'),
      topK: z.number().default(5).describe('Number of chunks to retrieve'),
    }),
    execute: async ({
      query,
      topK,
    }: {
      query: string;
      topK: number;
    }): Promise<
      { chunk_id: number; source_id: number; page: number; text: string; score: number }[]
    > => {
      try {
        const results = await embedStrategy.retrieve(query, notebookId, { topK });
        return results.map((r) => ({
          chunk_id: r.chunk_id,
          source_id: r.source_id,
          page: r.chunk_index,
          text: r.text.substring(0, 800),
          score: r.distance,
        }));
      } catch {
        return [];
      }
    },
  });

// ---------------------------------------------------------------------------
// Stream handler
// ---------------------------------------------------------------------------

/** Resolve retrieved chunks into Citation format for SSE done event. */
export async function resolveCitations(
  retrievedChunks: {
    chunk_id: number;
    source_id: number;
    page: number;
    text: string;
    score: number;
  }[],
): Promise<Citation[]> {
  return retrievedChunks.map((c) => ({
    source_id: c.source_id,
    source_name: `Source ${c.source_id}`,
    chunk_id: c.chunk_id,
    chunk_index: c.page,
    snippet: c.text.substring(0, 200),
    score: c.score,
  }));
}

/**
 * Run streaming QA with RAG tool integration.
 * Returns a Response with SSE event stream.
 */
export function streamQa(opts: QaHandlerOptions): Response {
  const retrievedChunks: {
    chunk_id: number;
    source_id: number;
    page: number;
    text: string;
    score: number;
  }[] = [];

  const tools = {
    retrieveSources: retrieveSourcesTool(opts.notebookId),
  };

  return streamQaResponse({
    model: opts.model,
    systemPrompt: opts.systemPrompt,
    messages: [...opts.history, { role: 'user' as const, content: opts.question }],
    tools,
    maxSteps: opts.maxSteps ?? 5,
    messageId: opts.messageId,
    citationsResolver: () => resolveCitations(retrievedChunks),
  });
}
