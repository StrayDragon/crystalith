import { describe, expect, it } from 'bun:test';

// Side-effect: server + feature routers call registerApiDoc at module load
// (no listen — import.meta.main is false).
import '../src/server.ts';
import { generateOpenApiDocument } from '../src/openapi.ts';
import { createApp } from '../src/server.ts';

describe('c71 OpenAPI generation (Zod v4)', () => {
  it('generates a document without throwing and includes key paths', () => {
    const doc = generateOpenApiDocument() as {
      openapi: string;
      paths: Record<string, Record<string, unknown>>;
      tags?: Array<{ name: string; description?: string }>;
    };

    expect(doc.openapi).toBe('3.1.0');
    const paths = Object.keys(doc.paths);
    expect(paths.length).toBeGreaterThan(10);

    expect(doc.paths['/v2/notebooks']?.get).toBeDefined();

    const health = doc.paths['/v2/health']?.get as { description?: string } | undefined;
    expect(health).toBeDefined();
    expect(health?.description).toBe('服务健康检查');

    const notebooksTag = doc.tags?.find((t) => t.name === 'notebooks');
    expect(notebooksTag?.description).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Route ↔ doc parity gate.
//
// `registerApiDoc` entries are hand-maintained next to the Elysia route chain,
// so drift is silent unless tested. This asserts every real HTTP route has a
// matching OpenAPI operation (and vice versa), except infrastructure surfaces
// that are deliberately not API endpoints.
// ---------------------------------------------------------------------------

/** Non-API routes excluded from the parity check (Scalar UI, spec files, index). */
const INFRA_ROUTE_ALLOWLIST = new Set([
  'GET /openapi',
  'GET /openapi.json',
  'GET /asyncapi.json',
  // Bare API index message (`{ message: 'Crystalith v2 API' }`).
  'GET /v2/',
]);

function collectRouteKeys(app: ReturnType<typeof createApp>): string[] {
  return app.routes
    .map((r: { method: string; path: string }) => `${r.method.toUpperCase()} ${r.path}`)
    .sort();
}

function collectDocKeys(): string[] {
  const doc = generateOpenApiDocument() as {
    paths: Record<string, Record<string, unknown>>;
  };
  const keys: string[] = [];
  for (const [path, ops] of Object.entries(doc.paths)) {
    for (const method of Object.keys(ops)) keys.push(`${method.toUpperCase()} ${path}`);
  }
  return keys.sort();
}

describe('route ↔ registerApiDoc parity', () => {
  it('every real route is documented', () => {
    const missing = collectRouteKeys(createApp()).filter(
      (key) => !INFRA_ROUTE_ALLOWLIST.has(key) && !collectDocKeys().includes(key),
    );
    expect(missing).toEqual([]);
  });

  it('every documented operation points at a real route', () => {
    const routes = new Set(collectRouteKeys(createApp()));
    const phantom = collectDocKeys().filter((key) => !routes.has(key));
    expect(phantom).toEqual([]);
  });
});
