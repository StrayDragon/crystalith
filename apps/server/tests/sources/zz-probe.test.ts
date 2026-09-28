import { mock } from 'bun:test';
mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: 'mocked' }),
  streamText: () => ({
    stream: (async function* () {})(),
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  tool: (def: unknown) => def,
}));
import { afterAll, beforeAll, expect, test } from 'bun:test';

import { eq } from 'drizzle-orm';

import { db } from '../../src/db/index.ts';
import { notebooks, sources } from '../../src/db/schema.ts';
import { selectParser } from '../../src/features/sources/parser-registry.ts';
import { createApp } from '../../src/server.ts';
import {
  setupIntegrationEnv,
  teardownIntegrationEnv,
  getOrm,
  stubEmbedding,
} from '../../tests/helpers/integration.ts';

let app: any;
beforeAll(async () => {
  setupIntegrationEnv();
  await stubEmbedding();
  app = createApp();
});
afterAll(teardownIntegrationEnv);

test('probe whitespace upload', async () => {
  console.log('selectParser(text/plain, blank.txt) =', selectParser('text/plain', 'blank.txt')?.id);
  const nb = getOrm().insert(notebooks).values({ name: 'probe' }).returning().get().id;
  const fd = new FormData();
  fd.append('file', new File(['   \n\t  \n'], 'blank.txt', { type: 'text/plain' }));
  const res = await app.handle(
    new Request(`http://test.local/v2/notebooks/${nb}/sources/upload`, {
      method: 'POST',
      body: fd,
    }),
  );
  const text = await res.text();
  console.log('status:', res.status, 'body:', text.slice(0, 160));
  console.log(
    'source rows:',
    db().select().from(sources).where(eq(sources.notebookId, nb)).all().length,
  );
  expect(true).toBe(true);
});
