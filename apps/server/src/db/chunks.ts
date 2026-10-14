// Single chunk-row write seam (c132 r487): every chunk insert MUST go through
// `insertChunk` so `text_tokens` (the keyword-channel token space indexed by
// chunks_fts) is always populated — a raw insert elsewhere would leave the row
// unsearchable by keyword.
import type { JsonMetadata } from '@crystalith/shared';

import { tokenizeForIndex } from '../rag/cjk-tokenizer.ts';
import { chunks, client, db } from './index.ts';

export interface NewChunkValues {
  sourceId: number;
  chunkIndex: number;
  text: string;
  startOffset?: number | null;
  endOffset?: number | null;
  metadata?: JsonMetadata | null;
  /** Origin generalization (c132 r485): 'source' default; derived output
   * chunks carry 'output' + the output id. */
  originType?: string;
  originId?: number | null;
  modality?: string;
}

/** Insert one chunk row (tokens computed here) and return the stored row. */
export async function insertChunk(values: NewChunkValues) {
  return (await client().get(
    db()
      .insert(chunks)
      .values({
        sourceId: values.sourceId,
        chunkIndex: values.chunkIndex,
        text: values.text,
        startOffset: values.startOffset ?? null,
        endOffset: values.endOffset ?? null,
        metadata: values.metadata ?? null,
        originType: values.originType ?? 'source',
        originId: values.originId ?? values.sourceId,
        modality: values.modality ?? 'text',
        textTokens: tokenizeForIndex(values.text),
      })
      .returning(),
  ))!;
}
