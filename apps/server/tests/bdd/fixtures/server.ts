// BDD server fixture — in-process Elysia app + isolated temp DB + empty config.
//
// Mirrors v1's module-scoped ASGI client: one temp SQLite file backs all
// scenarios in a run, and `app.handle(Request)` exercises real HTTP semantics
// without binding a port. Steps obtain a fresh TestContext per scenario via
// `makeContext()`, each carrying its own response bus + fixture store but
// sharing the underlying DB (matching v1's accumulation model).
import { afterAll, beforeAll } from 'bun:test';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Elysia } from 'elysia';

import { createDb, resetDb, type Orm } from '../../../src/db/index.ts';
import { createApp } from '../../../src/server.ts';
import { resetConfig } from '../../../src/shared/config.ts';
import type { BddResponse, TestClient, TestContext } from '../runner.ts';

// ---------------------------------------------------------------------------
// Single shared app + DB for the whole BDD run (module scope).
// ---------------------------------------------------------------------------

let app: Elysia;
let orm: Orm;
let tmpDbPath: string;

beforeAll(() => {
  tmpDbPath = join(tmpdir(), `crystalith-bdd-${process.pid}-${Date.now()}.db`);
  orm = createDb(tmpDbPath);
  resetDb(orm);
  // Empty config: most BDD scenarios test pure CRUD and never touch models;
  // those that do (qa/research/analysis) are marked @experimental and skipped.
  resetConfig({ models: { defaults: {}, available: [] }, raw: {} });
  app = createApp();
});

afterAll(() => {
  // SQLite WAL leaves -wal / -shm sidecar files; clean all three.
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(tmpDbPath + suffix, { force: true });
  }
});

// ---------------------------------------------------------------------------
// HTTP client — app.handle(Request) runs the full Elysia pipeline in-process.
// ---------------------------------------------------------------------------

// any host; app.handle ignores networking
const BASE = 'http://bdd.local';

async function request(method: string, path: string, body?: unknown): Promise<BddResponse> {
  const init: RequestInit = { method, headers: { 'content-type': 'application/json' } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await app.handle(new Request(BASE + path, init));
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });
  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed, headers, raw: res };
}

function makeClient(): TestClient {
  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    delete: (path) => request('DELETE', path),
    // Streaming endpoint: collect SSE lines into body for assertion.
    postStream: async (path, body) => {
      const res = await app.handle(
        new Request(BASE + path, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
          body: JSON.stringify(body ?? {}),
        }),
      );
      const text = await res.text();
      return { status: res.status, body: text, headers: {}, raw: res };
    },
  };
}

/** Build a per-scenario context with a fresh response bus + fixture store. */
export function makeContext(): TestContext {
  return {
    response: null,
    fixtures: {},
    client: makeClient(),
  };
}
