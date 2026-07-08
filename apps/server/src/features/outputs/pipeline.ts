import type { LanguageModelV4 } from '@ai-sdk/provider';
// Output pipeline — fetch chunks → build context → generateObject → persist.
//
// Single entry point for all output generation. Orchestrates:
//  1. Fetch chunk texts by IDs (or all notebook chunks if none specified)
//  2. Build context string
//  3. Call generateObject with schema
//  4. Map citations (chunk_id → source)
//  5. Persist to outputs table
import { eq, inArray } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { chunks, outputs, sources } from '../../db/schema.ts';
import { generateOutputByType, type ToolOutputType } from './generator.ts';

export interface PipelineInput {
  model: LanguageModelV4;
  notebookId: number;
  type: ToolOutputType;
  /** Optional specific chunk IDs to use. If empty, uses all notebook chunks. */
  chunkIds?: number[];
  /** Custom prompt override. */
  prompt?: string;
}

export interface PipelineResult {
  outputId: number;
  type: string;
  content: unknown;
  chunkCount: number;
}

/**
 * Run the full output generation pipeline.
 */
export async function runOutputPipeline(input: PipelineInput): Promise<PipelineResult> {
  // 1. Fetch chunks
  let chunkRows: { id: number; text: string; sourceId: number; chunkIndex: number }[];
  if (input.chunkIds && input.chunkIds.length > 0) {
    chunkRows = db()
      .select({
        id: chunks.id,
        text: chunks.text,
        sourceId: chunks.sourceId,
        chunkIndex: chunks.chunkIndex,
      })
      .from(chunks)
      .where(inArray(chunks.id, input.chunkIds))
      .all();
  } else {
    // All chunks for this notebook
    chunkRows = db()
      .select({
        id: chunks.id,
        text: chunks.text,
        sourceId: chunks.sourceId,
        chunkIndex: chunks.chunkIndex,
      })
      .from(chunks)
      .innerJoin(sources, eq(chunks.sourceId, sources.id))
      .where(eq(sources.notebookId, input.notebookId))
      .all();
  }

  // 2. Build context
  const context = chunkRows.map((c) => `[${c.chunkIndex}] ${c.text}`).join('\n\n');

  // 3. Generate
  const object = await generateOutputByType(input.model, input.type, context, input.prompt);

  // 4. Persist
  const row = db()
    .insert(outputs)
    .values({
      notebookId: input.notebookId,
      type: input.type,
      prompt: input.prompt ?? null,
      chunkIds: input.chunkIds ?? chunkRows.map((c) => c.id),
      content: object as Record<string, unknown>,
    })
    .returning()
    .get();

  return {
    outputId: row.id,
    type: input.type,
    content: object,
    chunkCount: chunkRows.length,
  };
}
