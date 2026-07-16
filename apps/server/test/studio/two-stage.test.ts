// Studio two-stage generation integration test.
//
// Exercises the full outline → markdown flow via the in-process Elysia app:
//   1. POST /v2/studio/slides            → create draft (stage='input')
//   2. POST /v2/studio/slides/:id/outline → generateObject (mocked) → stage='outline'
//   3. (review) ORM update of outline column
//   4. POST /v2/studio/slides/:id/markdown → streamText (mocked) → stage='markdown'
//
// generateObject returns a canned outline; streamText yields Slidev markdown
// text-deltas. Both are distinguished by the router's call site (not prompt
// parsing) since the router imports them as distinct named exports.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

const MOCK_OUTLINE = {
  title: 'Test Deck',
  slides: [
    { title: 'Intro', bullets: ['point one', 'point two'] },
    { title: 'Details', bullets: ['alpha', 'beta'] },
  ],
};
const MOCK_MARKDOWN =
  '---\ntheme: seriph\n---\n# Intro\n- point one\n- point two\n---\n# Details\n- alpha\n- beta\n';

// Mock the 'ai' module: generateObject → outline, streamText → markdown deltas.
mock.module('ai', () => ({
  generateObject: async () => ({ object: MOCK_OUTLINE }),
  generateText: async () => ({ text: MOCK_MARKDOWN }),
  streamText: () => ({
    fullStream: (async function* () {
      // Split into two deltas to verify accumulation across chunks.
      yield { type: 'text-delta', text: MOCK_MARKDOWN.slice(0, 20) };
      yield { type: 'text-delta', text: MOCK_MARKDOWN.slice(20) };
    })(),
    textStream: (async function* () {
      yield MOCK_MARKDOWN;
    })(),
  }),
  tool: (def: unknown) => def,
}));

import { eq } from 'drizzle-orm';
import type { Elysia } from 'elysia';

import { db } from '../../src/db/index.ts';
import { chunks, notebooks, sources, studioSlides } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import {
  setupIntegrationEnv,
  teardownIntegrationEnv,
  getOrm,
  seedChatModel,
} from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: Elysia;
let notebookId: number;
let sourceId: number;

beforeAll(() => {
  setupIntegrationEnv();
  seedChatModel();
  app = createApp();

  // Seed a notebook + source + chunk so getContext() returns non-empty text.
  const orm = getOrm();
  const nb = orm.insert(notebooks).values({ name: 'studio-nb' }).returning().get();
  notebookId = nb.id;
  const src = orm
    .insert(sources)
    .values({ notebookId, filename: 'doc.md', status: 'ready' })
    .returning()
    .get();
  sourceId = src.id;
  orm
    .insert(chunks)
    .values({ sourceId: src.id, chunkIndex: 0, text: 'Reference material for the slides.' })
    .run();
});

afterAll(() => {
  teardownIntegrationEnv();
});

async function post(path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
  const res = await app.handle(
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed };
}

describe('studio two-stage generation', () => {
  it('creates a slide draft in the input stage', async () => {
    const { status, body } = await post('/v2/studio/slides', {
      notebookId: notebookId,
      title: 'My Deck',
      prompt: 'Focus on clarity',
      sourceIds: [sourceId],
    });
    expect(status).toBe(200);
    const slide = body as { id: number; stage: string; status: string };
    expect(slide.stage).toBe('input');
    expect(slide.status).toBe('idle');
    expect(slide.id).toBeGreaterThan(0);
  });

  it('generates an outline (stage 1)', async () => {
    // Use the draft created above.
    const draft = getOrm()
      .select()
      .from(studioSlides)
      .where(eq(studioSlides.notebookId, notebookId))
      .all()[0];

    const { status, body } = await post(`/v2/studio/slides/${draft.id}/outline`);
    expect(status).toBe(200);
    const slide = body as { stage: string; outline: { title: string; slides: unknown[] } };
    expect(slide.stage).toBe('outline');
    expect(slide.outline).toBeTruthy();
    expect(slide.outline.title).toBe('Test Deck');
    expect(slide.outline.slides).toHaveLength(2);
  });

  it('generates markdown from the outline (stage 2)', async () => {
    const draft = getOrm()
      .select()
      .from(studioSlides)
      .where(eq(studioSlides.notebookId, notebookId))
      .all()[0];

    const { status, body } = await post(`/v2/studio/slides/${draft.id}/markdown`);
    expect(status).toBe(200);
    const slide = body as { stage: string; markdown: string };
    expect(slide.stage).toBe('markdown');
    expect(slide.markdown).toContain('---');
    // c56: default preset (minimal-clean) now emits theme: default (v1 parity),
    // not the prior v2-divergent 'seriph'.
    expect(slide.markdown).toContain('theme: default');
    expect(slide.markdown).toContain('# Intro');
  });

  it('reflects review edits to the outline between stages', async () => {
    // Create a fresh draft, generate outline, then edit the outline via ORM
    // (no PATCH endpoint exists) to simulate a user review, and confirm the
    // stored value changes.
    const created = await post('/v2/studio/slides', {
      notebookId: notebookId,
      title: 'Review Deck',
      sourceIds: [sourceId],
    });
    const id = (created.body as { id: number }).id;
    await post(`/v2/studio/slides/${id}/outline`);

    const edited = { title: 'Edited', slides: [{ title: 'Only Slide', bullets: ['revised'] }] };
    getOrm().update(studioSlides).set({ outline: edited }).where(eq(studioSlides.id, id)).run();

    const row = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
    expect(row).toBeTruthy();
    expect((row!.outline as { title: string }).title).toBe('Edited');
  });

  it('returns 404 when generating markdown before an outline exists', async () => {
    const created = await post('/v2/studio/slides', {
      notebookId: notebookId,
      title: 'No Outline Deck',
      sourceIds: [sourceId],
    });
    const id = (created.body as { id: number }).id;

    const { status } = await post(`/v2/studio/slides/${id}/markdown`);
    expect(status).toBe(404);
  });
});
