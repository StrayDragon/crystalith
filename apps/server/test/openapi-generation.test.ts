import { describe, expect, it } from 'bun:test';

// Side-effect: routers call registerApiDoc at module load (no createApp / worker).
import '../src/features/notebooks/router.ts';
import '../src/features/qa/router.ts';
import '../src/features/outputs/router.ts';
import '../src/features/citations/router.ts';
import { generateOpenApiDocument } from '../src/openapi.ts';

describe('c71 OpenAPI generation (Zod v4)', () => {
  it('generates a document without throwing and includes key paths', () => {
    const doc = generateOpenApiDocument() as {
      openapi: string;
      paths: Record<string, Record<string, unknown>>;
    };

    expect(doc.openapi).toBe('3.1.0');
    const paths = Object.keys(doc.paths);
    expect(paths.length).toBeGreaterThan(10);

    expect(doc.paths['/v2/notebooks']?.get).toBeDefined();
    expect(doc.paths['/v2/qa/presets']?.get).toBeDefined();
    expect(doc.paths['/v2/outputs/types']?.get).toBeDefined();
    expect(doc.paths['/v2/notebooks/:nid/citations/context']?.get).toBeDefined();
  });
});
