// covers: r245（source-connectors）+ r246（source-connectors）+ r247（source-connectors）+ r248（source-connectors）——发现端点返回 notebook 作用域连接器（含 schema 与诊断）、bindings 成功路径持久化配置、快照优先（请求快照不建来源）、import-scope 仅导入选中子集。
// Source connector happy-path integration tests (c53 / Wave D regression).
//
// Exercises the real source-connectors router end to end against a temp
// vault directory + temp DB, with AI + embedding stubbed:
//   GET  /v2/notebooks/:nid/source-connectors                       (r245)
//   POST /v2/notebooks/:nid/source-connectors/obsidian/bindings     (r246)
//   POST /v2/notebooks/:nid/source-connector-bindings/:id/snapshot  (r247)
//   POST /v2/notebooks/:nid/source-connector-bindings/:id/import-scope (r248)
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Stub the 'ai' module before importing the server (the summary pregenerate
// worker touches the AI runtime when sources land; --parallel isolation
// discipline requires the file to be self-sufficient).
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

import { eq } from 'drizzle-orm';

import { notebooks, sources } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import {
  getOrm,
  setupIntegrationEnv,
  stubEmbedding,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

const BASE = 'http://test.local';

let app: InstanceType<typeof createApp>;
let notebookId: number;
let vaultDir: string;

/** Write a non-trivial markdown note (chunker needs real content). */
function writeNote(relativePath: string, body: string): void {
  const fullPath = join(vaultDir, relativePath);
  mkdirSync(fullPath.slice(0, fullPath.lastIndexOf('/')), { recursive: true });
  writeFileSync(fullPath, body, 'utf8');
}

function sourceRowsFor(notebook: number) {
  return getOrm().select().from(sources).where(eq(sources.notebookId, notebook)).all();
}

beforeAll(async () => {
  setupIntegrationEnv();
  await stubEmbedding();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'connector-flow' }).returning().get().id;

  // Fixture vault: three notes, one of which will stay out of every import.
  vaultDir = mkdtempSync(join(tmpdir(), 'sc-vault-'));
  writeNote('alpha.md', '---\ntitle: Alpha\n---\n\nAlpha note. '.repeat(40));
  writeNote('beta.md', '---\ntitle: Beta\n---\n\nBeta note. '.repeat(40));
  writeNote('unselected.md', 'Unselected note. '.repeat(40));
});

afterAll(() => {
  rmSync(vaultDir, { force: true, recursive: true });
});

// ---------------------------------------------------------------------------
// r245 — discovery
// ---------------------------------------------------------------------------

describe('source-connector discovery (r245)', () => {
  it('lists notebook-scoped connectors with schema + diagnostics', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/source-connectors`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      connectors: Array<{
        connectorId: string;
        connectionConfigSchema: Record<string, unknown>;
        diagnostics: unknown;
        displayName: string;
      }>;
    };
    expect(body.connectors.length).toBeGreaterThan(0);

    const ids = body.connectors.map((c) => c.connectorId);
    expect(ids).toContain('obsidian');
    expect(ids).toContain('local-directory');

    for (const connector of body.connectors) {
      // Every entry carries the contract triple the frontend config UI needs.
      expect(connector.connectorId.length).toBeGreaterThan(0);
      expect(typeof connector.displayName).toBe('string');
      expect(connector.connectionConfigSchema).toBeTruthy();
      expect(connector.connectionConfigSchema.type).toBe('object');
      expect(Array.isArray(connector.connectionConfigSchema.required)).toBe(true);
      expect('diagnostics' in connector).toBe(true);
    }
  });

  it('scopes discovery to an existing notebook (unknown notebook → 404)', async () => {
    const res = await app.handle(new Request(`${BASE}/v2/notebooks/999999/source-connectors`));
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// r246 — binding happy path (persistence)
// ---------------------------------------------------------------------------

describe('source-connector binding creation (r246)', () => {
  it('persists a notebook-scoped binding for a legal vaultPath (201)', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/source-connectors/obsidian/bindings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionConfig: { vaultPath: vaultDir } }),
      }),
    );
    expect(res.status).toBe(201);
    const binding = (await res.json()) as {
      id: number;
      connectorId: string;
      connectionConfig: { vaultPath: string };
      importScope: unknown;
      lastConfirmedSnapshot: unknown;
    };
    expect(binding.connectorId).toBe('obsidian');
    expect(binding.connectionConfig.vaultPath).toBe(vaultDir);
    expect(binding.importScope).toBeNull();
    expect(binding.lastConfirmedSnapshot).toBeNull();

    // Persistence: the stored config is reusable by binding id alone — the
    // snapshot endpoint takes only notebookId + bindingId (no config re-send).
    const snap = await app.handle(
      new Request(
        `${BASE}/v2/notebooks/${notebookId}/source-connector-bindings/${binding.id}/snapshot`,
        { method: 'POST' },
      ),
    );
    expect(snap.status).toBe(200);
    const snapshot = (await snap.json()) as { entries: Array<{ relativePath: string }> };
    expect(snapshot.entries.map((e) => e.relativePath)).toContain('alpha.md');
  });
});

// ---------------------------------------------------------------------------
// r247 — snapshot-first (preview without importing)
// ---------------------------------------------------------------------------

describe('vault snapshot before import (r247)', () => {
  it('returns a previewable snapshot and creates zero sources', async () => {
    const created = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/source-connectors/obsidian/bindings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionConfig: { vaultPath: vaultDir } }),
      }),
    );
    const binding = (await created.json()) as { id: number };

    const before = sourceRowsFor(notebookId).length;
    const res = await app.handle(
      new Request(
        `${BASE}/v2/notebooks/${notebookId}/source-connector-bindings/${binding.id}/snapshot`,
        { method: 'POST' },
      ),
    );
    expect(res.status).toBe(200);
    const snapshot = (await res.json()) as {
      generatedAt: string;
      entries: Array<{ relativePath: string; sizeBytes: number; modifiedAt: string }>;
    };
    expect(snapshot.generatedAt).toBeTruthy();

    // Previewable: all vault notes (markdown only) sorted by path.
    const paths = snapshot.entries.map((e) => e.relativePath);
    expect(paths).toEqual(['alpha.md', 'beta.md', 'unselected.md']);
    expect(snapshot.entries[0]!.sizeBytes).toBeGreaterThan(0);
    expect(snapshot.entries[0]!.modifiedAt).toBeTruthy();

    // Snapshot-first: requesting a snapshot MUST NOT import anything.
    expect(sourceRowsFor(notebookId).length).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// r248 — selective import scope
// ---------------------------------------------------------------------------

describe('import-scope selective import (r248)', () => {
  it('imports only the selected subset of vault notes', async () => {
    const created = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/source-connectors/obsidian/bindings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionConfig: { vaultPath: vaultDir } }),
      }),
    );
    const binding = (await created.json()) as { id: number };

    const res = await app.handle(
      new Request(
        `${BASE}/v2/notebooks/${notebookId}/source-connector-bindings/${binding.id}/import-scope`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ includeFiles: ['alpha.md', 'beta.md'] }),
        },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      binding: {
        importScope: { includeFiles: string[] | null; includeDirectories: string[] | null };
      };
      importedSourceIds: number[];
      results: Array<{ relativePath: string; status: string; sourceId: number | null }>;
    };

    // Selected subset only: both chosen files imported, nothing else.
    const imported = body.results.filter((r) => r.status === 'imported');
    expect(imported.map((r) => r.relativePath).sort()).toEqual(['alpha.md', 'beta.md']);
    expect(body.importedSourceIds.length).toBe(2);

    // The binding persists the explicit scope for later sync-checks.
    expect(body.binding.importScope.includeFiles).toEqual(['alpha.md', 'beta.md']);
    expect(body.binding.importScope.includeDirectories).toBeNull();

    // Only the selected notes became sources; the unselected vault note is absent.
    const rows = sourceRowsFor(notebookId);
    const names = rows.map((r) => r.filename).sort();
    expect(names).toEqual(['alpha.md', 'beta.md']);
    expect(names).not.toContain('unselected.md');
    for (const row of rows) expect(row.status).toBe('ready');
  });

  it('directory scope narrows the import to that subtree', async () => {
    writeNote(join('sub', 'gamma.md'), 'Gamma note. '.repeat(40));
    // Distinct notebook so source sets cannot bleed between cases.
    const otherNotebook = getOrm()
      .insert(notebooks)
      .values({ name: 'connector-flow-dir' })
      .returning()
      .get().id;
    const created = await app.handle(
      new Request(`${BASE}/v2/notebooks/${otherNotebook}/source-connectors/obsidian/bindings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionConfig: { vaultPath: vaultDir } }),
      }),
    );
    const binding = (await created.json()) as { id: number };

    const res = await app.handle(
      new Request(
        `${BASE}/v2/notebooks/${otherNotebook}/source-connector-bindings/${binding.id}/import-scope`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ includeDirectories: ['sub'] }),
        },
      ),
    );
    expect(res.status).toBe(200);
    const names = sourceRowsFor(otherNotebook)
      .map((r) => r.filename)
      .sort();
    expect(names).toEqual([join('sub', 'gamma.md').replaceAll('\\', '/')]);
  });
});
