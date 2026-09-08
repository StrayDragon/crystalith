// c62 tests — extractors response field shape + default by availability.
import { beforeAll, describe, expect, it } from 'bun:test';

import { pluginRegistry } from '../../src/plugins/registry.ts';
import { getDefaultExtractor, listExtractorMetadata } from '../../src/shared/extraction/factory.ts';

beforeAll(async () => {
  await pluginRegistry.ensureLoaded();
});

describe('c62: listExtractorMetadata field shape', () => {
  it('each extractor has type, enabled, description, requiresService', () => {
    const meta = listExtractorMetadata({});
    for (const e of meta) {
      expect(e.type).toBeDefined();
      expect(typeof e.enabled).toBe('boolean');
      expect(typeof e.description).toBe('string');
      expect(e.description.length).toBeGreaterThan(0);
      expect(typeof e.requiresService).toBe('boolean');
      expect(typeof e.displayName).toBe('string');
    }
  });

  it('readability does not require a service; jina/firecrawl do', () => {
    const meta = listExtractorMetadata({});
    const readability = meta.find((e) => e.name === 'readability')!;
    const jina = meta.find((e) => e.name === 'jina')!;
    const firecrawl = meta.find((e) => e.name === 'firecrawl')!;
    expect(readability.requiresService).toBe(false);
    expect(jina.requiresService).toBe(true);
    expect(firecrawl.requiresService).toBe(true);
  });
});

describe('c62: getDefaultExtractor by availability', () => {
  it('returns first available extractor', () => {
    // With empty config, readability should be available (no key needed)
    const def = getDefaultExtractor({});
    expect(def).toBe('readability');
  });
});
