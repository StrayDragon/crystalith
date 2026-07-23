import { describe, expect, it } from 'bun:test';

// Side-effect: server + feature routers call registerApiDoc at module load
// (no listen — import.meta.main is false).
import '../src/server.ts';
import { generateOpenApiDocument } from '../src/openapi.ts';

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
