// Research domain — run result conversion (note / source).
// Extracted from commands.ts (elysia review B1): single-concern modules,
// consumers keep importing from ./commands.ts (facade re-exports).
import type { ResearchConvertBody } from '@crystalith/shared';
import { eq } from 'drizzle-orm';

import { client, db } from '../../db/index.ts';
import { chunks, outputs, sources } from '../../db/schema.ts';
import { bumpSourcesEpoch } from '../../rag/cache.ts';
import { logger } from '../../shared/logger.ts';
import { splitTextToChunks } from '../outputs/render.ts';
import { resolveArtifactMarkdown } from './report.ts';

export async function convertToNote(
  notebookId: number,
  runId: number,
  body: ResearchConvertBody,
): Promise<{ outputId: number; type: 'PARAGRAPH' }> {
  const { title, markdown } = await resolveArtifactMarkdown(notebookId, runId, body.artifact);
  const output = (await client().get(
    db()
      .insert(outputs)
      .values({
        notebookId,
        type: 'PARAGRAPH',
        prompt: title,
        chunkIds: [],
        content: {
          title,
          text: markdown,
          // 兜底：笔记栏可跳回 Lab 报告页（正式产品导航另案设计）
          researchLab: {
            notebookId,
            runId,
            artifactKind: body.artifact.kind,
          },
        },
      })
      .returning(),
  ))!;
  return { outputId: output.id, type: 'PARAGRAPH' };
}

export async function convertToSource(
  notebookId: number,
  runId: number,
  body: ResearchConvertBody,
): Promise<{ sourceId: number; filename: string; chunkCount: number }> {
  const { title, markdown } = await resolveArtifactMarkdown(notebookId, runId, body.artifact);
  const chunkTexts = splitTextToChunks(markdown, 500, 50);
  const filename = `research-${runId}-${body.artifact.kind}.md`;

  const sourceRow = (await client().get(
    db()
      .insert(sources)
      .values({
        notebookId,
        filename,
        mimeType: 'text/markdown',
        parserType: 'text',
        status: 'processing',
        metadata: {
          type: 'research_conversion',
          source: 'research_conversion',
          runId,
          artifact: body.artifact,
          title,
        },
      })
      .returning(),
  ))!;

  let offset = 0;
  for (const [i, text] of chunkTexts.entries()) {
    await client().run(
      db()
        .insert(chunks)
        .values({
          sourceId: sourceRow.id,
          chunkIndex: i,
          text,
          startOffset: offset,
          endOffset: offset + text.length,
        }),
    );
    offset += text.length + 2;
  }

  try {
    const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
    const strategy = new EmbedStrategy();
    await strategy.indexSource(sourceRow.id, sourceRow.notebookId);
    await client().run(
      db().update(sources).set({ status: 'ready' }).where(eq(sources.id, sourceRow.id)),
    );
    bumpSourcesEpoch(sourceRow.notebookId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('convert-to-source embed failed', { sourceId: sourceRow.id, message });
    await client().run(
      db()
        .update(sources)
        .set({
          status: 'failed',
          errorMessage: message.slice(0, 2000),
          errorCode: 'EMBEDDING_FAILED',
        })
        .where(eq(sources.id, sourceRow.id)),
    );
    bumpSourcesEpoch(sourceRow.notebookId);
  }

  return {
    sourceId: sourceRow.id,
    filename: sourceRow.filename,
    chunkCount: chunkTexts.length,
  };
}
