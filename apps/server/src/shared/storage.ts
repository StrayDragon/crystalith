// Content storage abstraction — persists raw uploaded bytes so the
// document_parse task can re-parse them later (e.g. re-chunk/re-embed).
//
// LocalStorage impl uses the filesystem (design.md Option 2): each source's
// raw bytes live at `<basePath>/<sourceId>`. Bun's file I/O is fast (io_uring)
// and keeps large blobs out of SQLite.
//
// The base directory is derived from storage.data_root (see getDataRoot()).
// Override individually via CL_STORAGE_PATH env (legacy, will be removed).
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { getDataRoot } from './config.ts';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Storage {
  /** Persist raw bytes for a source; returns the stored path. */
  save(sourceId: number, buffer: Uint8Array): Promise<string>;
  /** Read raw bytes for a source. Throws if not stored. */
  fetch(sourceId: number): Promise<Uint8Array>;
  /** Delete a source's stored bytes. No-op if absent. */
  delete(sourceId: number): Promise<void>;
  /** Whether bytes are stored for a source. */
  exists(sourceId: number): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// LocalStorage (filesystem)
// ---------------------------------------------------------------------------

export class LocalStorage implements Storage {
  constructor(private basePath: string) {}

  private path(sourceId: number): string {
    return join(this.basePath, String(sourceId));
  }

  async save(sourceId: number, buffer: Uint8Array): Promise<string> {
    const p = this.path(sourceId);
    await mkdir(dirname(p), { recursive: true });
    await Bun.write(p, buffer);
    return p;
  }

  async fetch(sourceId: number): Promise<Uint8Array> {
    const p = this.path(sourceId);
    const data = await readFile(p);
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  async delete(sourceId: number): Promise<void> {
    const p = this.path(sourceId);
    await rm(p, { force: true });
  }

  async exists(sourceId: number): Promise<boolean> {
    const p = this.path(sourceId);
    try {
      await stat(p);
      return true;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

const DEFAULT_BASE = join(getDataRoot(), 'storage');

export const contentStorage: Storage = new LocalStorage(DEFAULT_BASE);

// Re-export for tests that want a throwaway instance.
export { existsSync };
