// Unit test: DbClient port semantics (all/get/run/raw/rawRun).
//
// Uses a temp DB file under data/ so it never touches the real crystalith.db.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { rmSync } from 'node:fs';

import { eq, sql } from 'drizzle-orm';

import { createDbClient } from '../src/db/client.ts';
import { createDb, type Orm } from '../src/db/index.ts';
import { notebooks } from '../src/db/schema.ts';

const TMP_DB = 'data/test-db-client.db';

let orm: Orm;

beforeAll(() => {
  for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) rmSync(f, { force: true });
  orm = createDb(TMP_DB);
});

afterAll(() => {
  for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) rmSync(f, { force: true });
});

describe('db-client: builder terminals', () => {
  it('all/get/run wrap drizzle builders in promises', async () => {
    const c = createDbClient(orm);

    const inserted = await c.all(orm.insert(notebooks).values({ name: 'a' }).returning());
    expect(inserted).toHaveLength(1);

    const row = await c.get(orm.select().from(notebooks).where(eq(notebooks.name, 'a')));
    expect(row?.name).toBe('a');

    const missing = await c.get(orm.select().from(notebooks).where(eq(notebooks.name, 'nope')));
    expect(missing).toBeUndefined();

    await c.run(orm.update(notebooks).set({ name: 'b' }).where(eq(notebooks.name, 'a')));
    const renamed = await c.get(orm.select().from(notebooks).where(eq(notebooks.name, 'b')));
    expect(renamed?.name).toBe('b');
  });
});

describe('db-client: raw sql templates', () => {
  it('raw/rawRun evaluate sql`` statements', async () => {
    const c = createDbClient(orm);

    await c.run(orm.insert(notebooks).values({ name: 'raw' }));

    await c.rawRun(sql`UPDATE notebooks SET name = 'raw2' WHERE name = 'raw'`);
    const rows = await c.raw<{ id: number; name: string }>(
      sql`SELECT id, name FROM notebooks WHERE name = 'raw2'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('raw2');
  });
});
