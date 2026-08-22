import { SourceFromUrlRequestSchema } from '@crystalith/shared';
// URL ingestion service — POST /sources/from-url (c39/c44/c62).
//
// Extracted from router.ts to keep the HTTP layer thin. The handler maps the
// returned outcome union to HTTP status codes; all business rules live here:
// SSRF pre-check, config-gated dedup (prompt/reuse/create_new), link mode,
// extractor order with raw-fetch SSRF-guarded fallback.
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../../db/index.ts';
import { chunks, sources } from '../../db/schema.ts';
import { bumpSourcesEpoch } from '../../rag/cache.ts';
import { getDedupEnabled, getSecurityPolicy } from '../../shared/config.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { extractUrl } from '../../shared/extraction/factory.ts';
import { fetchWithRedirectGuard } from '../../shared/net/fetch-with-redirect-guard.ts';
import { validateUrlForFetch, SsrfBlockedError } from '../../shared/net/url-safety.ts';
import { urlDedupKey } from './dedup.ts';
import { ingestSource, type IngestResult } from './pipeline.ts';

type SourceFromUrlBody = z.infer<typeof SourceFromUrlRequestSchema>;

const DedupActionSchema = z.enum(['prompt', 'reuse', 'create_new']);

/** Terminal outcomes for URL ingestion; router maps each to a status code. */
export type IngestFromUrlOutcome =
  // Dedup reuse — router re-reads the source detail for the wire shape.
  | { kind: 'reused'; sourceId: number }
  /** Link mode created a lightweight source. */
  | {
      kind: 'created-link';
      payload: { sourceId: number; filename: string; mode: 'link' };
    }
  /** Extractor pipeline succeeded (extractor metadata attached). */
  | { kind: 'extracted'; payload: IngestResult & { extractedBy: string; title: string | null } }
  /** Raw-fetch fallback succeeded. */
  | { kind: 'ingested'; payload: IngestResult };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function ingestFromUrl(
  nid: number,
  body: SourceFromUrlBody,
  query: unknown,
): Promise<IngestFromUrlOutcome> {
  const { url, mode, title, extractor, snippet } = body;
  const dedupParsed = DedupActionSchema.safeParse(
    isRecord(query) ? (query.dedupAction ?? 'prompt') : 'prompt',
  );
  const dedupAction = dedupParsed.success ? dedupParsed.data : 'prompt';

  // SSRF guard: validate URL before fetch.
  try {
    await validateUrlForFetch(url, getSecurityPolicy());
  } catch (error) {
    throw new AppHttpError(ErrorCode.SCHEMA_VALIDATION_FAILED, 'SSRF blocked', {
      reason: errorMessage(error),
    });
  }

  // c44: Dedup check — gated by config (v1 source_ingestion.dedup.enabled)
  const dedupKey = getDedupEnabled() ? urlDedupKey(url) : undefined;
  if (dedupKey && dedupAction !== 'create_new') {
    const hit = db()
      .select({ id: sources.id })
      .from(sources)
      .where(and(eq(sources.notebookId, nid), eq(sources.dedupKey, dedupKey)))
      .get();
    if (hit) {
      if (dedupAction === 'prompt') {
        throw new AppHttpError(ErrorCode.CONFLICT, 'Source dedup hit', {
          existingSourceId: hit.id,
        });
      }
      if (dedupAction === 'reuse') {
        return { kind: 'reused', sourceId: hit.id };
      }
    }
  }

  // Link mode: create a lightweight source, then embed so it is searchable (v1 still embeds)
  if (mode === 'link') {
    return createLinkSource(nid, url, title, snippet, dedupKey);
  }

  return fetchAndIngest(nid, url, title, extractor, dedupKey);
}

/** Link mode: store title+snippet as a single chunk; embed best-effort (c62). */
async function createLinkSource(
  nid: number,
  url: string,
  title: string | null | undefined,
  snippet: string | null | undefined,
  dedupKey: string | undefined,
): Promise<IngestFromUrlOutcome> {
  const linkTitle = title ?? url;
  // c62: use snippet from body if provided (v1 api_ingest.py:381-390)
  const content = snippet
    ? `# ${linkTitle}\n\n${snippet}\n\n来源: ${url}`
    : `# ${linkTitle}\n\n${url}\n\n来源链接（未抓取正文）`;
  const sourceRow = db()
    .insert(sources)
    .values({
      notebookId: nid,
      filename: linkTitle,
      mimeType: 'text/plain',
      parserType: 'link',
      status: 'processing',
      dedupKey,
      metadata: { url, mode: 'link' },
    })
    .returning()
    .get();
  db()
    .insert(chunks)
    .values({
      sourceId: sourceRow.id,
      chunkIndex: 0,
      text: content,
      metadata: { url, type: 'link' },
    })
    .run();

  try {
    const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
    const strategy = new EmbedStrategy();
    await strategy.indexSource(sourceRow.id, nid);
    db().update(sources).set({ status: 'ready' }).where(eq(sources.id, sourceRow.id)).run();
    const { scheduleSourceSummary } = await import('./source-summary.ts');
    scheduleSourceSummary(sourceRow.id);
  } catch (error) {
    db()
      .update(sources)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      .where(eq(sources.id, sourceRow.id))
      .run();
  }
  bumpSourcesEpoch(nid);
  return {
    kind: 'created-link',
    payload: { sourceId: sourceRow.id, filename: linkTitle, mode: 'link' },
  };
}

/** Default mode: extractor pipeline first, then SSRF-guarded raw fetch fallback (P0-3). */
async function fetchAndIngest(
  nid: number,
  url: string,
  title: string | null | undefined,
  extractor: string | null | undefined,
  dedupKey: string | undefined,
): Promise<IngestFromUrlOutcome> {
  try {
    // c62: pass extractor order if specified (v1 preferred-extractor)
    const order = extractor ? [extractor] : undefined;
    const extracted = await extractUrl(url, {}, order);
    const buffer = new TextEncoder().encode(extracted.content);
    const result = await ingestSource({
      buffer,
      // intentionally || — filename fallback chain
      // oxlint-disable-next-line typescript/prefer-nullish-coalescing
      filename: extracted.title || title || url.split('/').pop() || 'webpage.html',
      notebookId: nid,
      mimeType: 'text/html',
      dedupKey,
    });
    return {
      kind: 'extracted',
      payload: { ...result, extractedBy: extracted.extractorUsed, title: extracted.title },
    };
  } catch {
    // Fallback to raw fetch if extractors all fail.
    // P0-3: use fetchWithRedirectGuard so the initial URL AND every redirect
    // hop are validated against the SSRF policy (replaces the c39 single
    // pre-check + bare fetch that followed redirects unsafely).
    let response: Response;
    try {
      response = await fetchWithRedirectGuard(url, getSecurityPolicy());
    } catch (error) {
      throw new AppHttpError(
        ErrorCode.SCHEMA_VALIDATION_FAILED,
        error instanceof SsrfBlockedError ? 'SSRF blocked on fallback' : 'fetch failed on fallback',
        { reason: errorMessage(error) },
      );
    }
    const html = await response.text();
    const buffer = new TextEncoder().encode(html);
    const result = await ingestSource({
      buffer,
      // intentionally || — filename fallback chain
      // oxlint-disable-next-line typescript/prefer-nullish-coalescing
      filename: title || url.split('/').pop() || 'webpage.html',
      notebookId: nid,
      mimeType: 'text/html',
      dedupKey,
    });
    return { kind: 'ingested', payload: result };
  }
}
