import { unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Fresh SQLite for each Playwright run so P0 gate is deterministic.
 */
export default async function globalSetup() {
  const tmp = resolve(import.meta.dirname, '../.tmp');
  mkdirSync(tmp, { recursive: true });
  for (const name of ['crystalith.e2e.db', 'crystalith.e2e.db-wal', 'crystalith.e2e.db-shm']) {
    const p = resolve(tmp, name);
    if (existsSync(p)) unlinkSync(p);
  }
}
