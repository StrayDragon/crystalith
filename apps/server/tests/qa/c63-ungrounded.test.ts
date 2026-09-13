// c63: empty source_ids → ungrounded chat regardless of notebook source count.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { notebooks, sources } from '../../src/db/schema.ts';
import { retrieveAndJudge } from '../../src/features/qa/retrieve-and-judge.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

beforeAll(setupIntegrationEnv);
afterAll(teardownIntegrationEnv);

describe('c63 retrieveAndJudge empty source scope', () => {
  it('returns ungrounded evidence when notebook has zero sources', async () => {
    const nb = getOrm().insert(notebooks).values({ name: 'c63-empty-nb' }).returning().get();
    const result = await retrieveAndJudge({
      notebookId: nb.id,
      question: 'hello without sources',
    });
    expect(result.evidence).toBe(true);
    expect(result.citations).toEqual([]);
    expect(result.context).toBe('');
    expect(result.confidence).toBe(0);
    expect(result.reason).toBeUndefined();
  });

  it('returns ungrounded evidence when source_ids omitted but notebook has sources', async () => {
    const orm = getOrm();
    const nb = orm.insert(notebooks).values({ name: 'c63-ungrounded-nb' }).returning().get();
    orm.insert(sources).values({ notebookId: nb.id, filename: 'note.md', status: 'ready' }).run();

    const result = await retrieveAndJudge({
      notebookId: nb.id,
      question: 'chat without selecting sources',
    });
    expect(result.evidence).toBe(true);
    expect(result.citations).toEqual([]);
    expect(result.context).toBe('');
    expect(result.confidence).toBe(0);
    expect(result.reason).toBeUndefined();
  });

  it('returns ungrounded evidence when source_ids is an empty array', async () => {
    const orm = getOrm();
    const nb = orm.insert(notebooks).values({ name: 'c63-empty-ids-nb' }).returning().get();
    orm.insert(sources).values({ notebookId: nb.id, filename: 'a.md', status: 'ready' }).run();

    const result = await retrieveAndJudge({
      notebookId: nb.id,
      question: 'empty array scope',
      sourceIds: [],
    });
    expect(result.evidence).toBe(true);
    expect(result.citations).toEqual([]);
    expect(result.context).toBe('');
  });
});
