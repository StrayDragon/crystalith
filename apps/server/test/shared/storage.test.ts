// Tests for LocalStorage content persistence (uses OS temp dir, no network).
import { afterAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LocalStorage } from '../../src/shared/storage.ts';

const tmpBase = mkdtempSync(join(tmpdir(), 'cl-storage-test-'));
const storage = new LocalStorage(tmpBase);

afterAll(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe('LocalStorage', () => {
  it('save then fetch round-trips bytes', async () => {
    const buf = new TextEncoder().encode('hello crystalith');
    await storage.save(101, buf);
    const back = await storage.fetch(101);
    expect(new TextDecoder().decode(back)).toBe('hello crystalith');
  });

  it('exists reports true after save, false before', async () => {
    expect(await storage.exists(202)).toBe(false);
    await storage.save(202, new Uint8Array([1, 2, 3]));
    expect(await storage.exists(202)).toBe(true);
  });

  it('delete removes the stored bytes', async () => {
    await storage.save(303, new Uint8Array([9]));
    expect(await storage.exists(303)).toBe(true);
    await storage.delete(303);
    expect(await storage.exists(303)).toBe(false);
  });

  it('delete is a no-op when absent', async () => {
    await storage.delete(404); // should not throw
    expect(await storage.exists(404)).toBe(false);
  });
});
