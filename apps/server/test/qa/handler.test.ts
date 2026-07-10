// QA confidence + citation resolution — real function tests.
//
// The old confidence.test.ts redefined computeConfidence inline with a
// different signature; this file imports the REAL functions and exercises the
// actual handler logic (source-name hydration, snippet truncation, confidence
// formula) against a temp DB.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import type { Citation } from '@crystalith/shared';

import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { computeConfidence } from '../../src/features/qa/confidence.ts';
import { resolveCitations } from '../../src/features/qa/handler.ts';
import { setupIntegrationEnv, teardownIntegrationEnv, getOrm } from '../helpers/integration.ts';

beforeAll(setupIntegrationEnv);
afterAll(teardownIntegrationEnv);

// ---------------------------------------------------------------------------
// computeConfidence — the real exported function
// ---------------------------------------------------------------------------

describe('computeConfidence (real)', () => {
  it('returns 0 for empty citations', () => {
    expect(computeConfidence([], 5, 5)).toBe(0);
  });

  it('approaches ~1 when similarity, coverage, and citation depth are all maxed', () => {
    // 5 citations across 5 sources, all score 1.0, topK 5.
    const citations: Citation[] = Array.from({ length: 5 }, (_, i) => ({
      source_id: i + 1,
      source_name: `s${i}`,
      chunk_id: i + 1,
      chunk_index: i,
      snippet: 'x',
      score: 1,
    }));
    // similarityAvg=1, coverageRatio=5/5=1, citationRatio=min(1,5/5)=1 → 1.0
    expect(computeConfidence(citations, 5, 5)).toBeCloseTo(1, 5);
  });

  it('citation ratio caps at 1 even when citations exceed topK', () => {
    const citations: Citation[] = Array.from({ length: 10 }, (_, i) => ({
      source_id: 1,
      source_name: 's',
      chunk_id: i + 1,
      chunk_index: i,
      snippet: 'x',
      score: 1,
    }));
    // citationRatio = min(1, 10/5) = 1, not 2.
    const score = computeConfidence(citations, 1, 5);
    expect(score).toBeLessThanOrEqual(1);
    expect(score).toBeCloseTo(1, 5);
  });

  it('more citations (up to topK) yield a higher score, all else equal', () => {
    const mk = (n: number): Citation[] =>
      Array.from({ length: n }, (_, i) => ({
        source_id: i + 1,
        source_name: `s${i}`,
        chunk_id: i + 1,
        chunk_index: i,
        snippet: 'x',
        score: 0.8,
      }));
    const one = computeConfidence(mk(1), 5, 5);
    const three = computeConfidence(mk(3), 5, 5);
    expect(three).toBeGreaterThan(one);
  });
});

// ---------------------------------------------------------------------------
// resolveCitations — real function against a seeded temp DB
// ---------------------------------------------------------------------------

describe('resolveCitations (real, DB-backed)', () => {
  it('hydrates source_name from the sources table', async () => {
    const orm = getOrm();
    const nb = orm.insert(notebooks).values({ name: 'nb' }).returning().get();
    const src = orm
      .insert(sources)
      .values({ notebookId: nb.id, filename: 'report.pdf', status: 'ready' })
      .returning()
      .get();
    const chunk = orm
      .insert(chunks)
      .values({ sourceId: src.id, chunkIndex: 0, text: 'some evidence text' })
      .returning()
      .get();

    const retrieved = [
      {
        chunk_id: chunk.id,
        source_id: src.id,
        chunk_index: 0,
        text: 'some evidence text',
        score: 0.9,
      },
    ];

    const citations = await resolveCitations(retrieved);
    expect(citations).toHaveLength(1);
    expect(citations[0].source_name).toBe('report.pdf');
    expect(citations[0].score).toBe(0.9);
  });

  it('truncates the snippet to 200 characters', async () => {
    const orm = getOrm();
    const nb = orm.insert(notebooks).values({ name: 'nb2' }).returning().get();
    const src = orm
      .insert(sources)
      .values({ notebookId: nb.id, filename: 'big.txt', status: 'ready' })
      .returning()
      .get();
    const longText = 'x'.repeat(500);
    const chunk = orm
      .insert(chunks)
      .values({ sourceId: src.id, chunkIndex: 0, text: longText })
      .returning()
      .get();

    const citations = await resolveCitations([
      {
        chunk_id: chunk.id,
        source_id: src.id,
        chunk_index: 0,
        text: longText,
        score: 0.5,
      },
    ]);
    expect(citations[0].snippet.length).toBe(200);
  });

  it('returns [] for empty input without touching the DB', async () => {
    const citations = await resolveCitations([]);
    expect(citations).toEqual([]);
  });

  it('falls back to "unknown" for a missing source row', async () => {
    // source_id 99999 does not exist — resolveCitations must not throw.
    const citations = await resolveCitations([
      { chunk_id: 1, source_id: 99999, chunk_index: 0, text: 'orphan', score: 0.1 },
    ]);
    expect(citations[0].source_name).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// computeConfidence + resolveCitations integration (confidence from hydrated)
// ---------------------------------------------------------------------------

describe('confidence from real citations', () => {
  it('computes a non-zero score when evidence is present', async () => {
    const orm = getOrm();
    const nb = orm.insert(notebooks).values({ name: 'nb-conf' }).returning().get();
    const src = orm
      .insert(sources)
      .values({ notebookId: nb.id, filename: 'doc.md', status: 'ready' })
      .returning()
      .get();
    const ch = orm
      .insert(chunks)
      .values({ sourceId: src.id, chunkIndex: 0, text: 'evidence' })
      .returning()
      .get();

    const citations = await resolveCitations([
      { chunk_id: ch.id, source_id: src.id, chunk_index: 0, text: 'evidence', score: 0.9 },
    ]);
    // 1 source in notebook → coverageRatio = 1/1 = 1
    const score = computeConfidence(citations, 1, 5);
    expect(score).toBeGreaterThan(0);
    // similarityAvg=0.9, coverageRatio=1, citationRatio=0.2 → (0.9+1+0.2)/3 ≈ 0.7
    expect(score).toBeCloseTo(0.7, 1);
  });
});
