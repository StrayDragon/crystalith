import { afterEach, describe, expect, it } from 'bun:test';

import {
  isWebExtractorEnabled,
  resolveFirecrawlApiKey,
  resolveJinaApiKey,
} from '../../src/shared/extraction/config.ts';
import { listExtractorMetadata } from '../../src/shared/extraction/factory.ts';

const CL_KEYS = ['CL_JINA_API_KEY', 'CL_FIRECRAWL_API_KEY'] as const;

afterEach(() => {
  for (const key of CL_KEYS) delete process.env[key];
});

describe('extractor config wiring (source_ingestion.web_extraction)', () => {
  it('prefers CL_JINA_API_KEY / CL_FIRECRAWL_API_KEY over yaml keys', () => {
    process.env.CL_JINA_API_KEY = 'cl-jina';
    process.env.CL_FIRECRAWL_API_KEY = 'cl-fc';
    const cfg = {
      source_ingestion: {
        web_extraction: {
          jina: { enabled: true, api_key: 'yaml-jina' },
          firecrawl: { enabled: true, api_key: 'yaml-fc' },
        },
      },
    };
    expect(resolveJinaApiKey(cfg)).toBe('cl-jina');
    expect(resolveFirecrawlApiKey(cfg)).toBe('cl-fc');
  });

  it('reads jina/firecrawl keys from web_extraction', () => {
    const cfg = {
      source_ingestion: {
        web_extraction: {
          jina: { enabled: true, api_key: 'jina-from-yaml' },
          firecrawl: { enabled: true, api_key: 'fc-from-yaml' },
        },
      },
    };
    expect(resolveJinaApiKey(cfg)).toBe('jina-from-yaml');
    expect(resolveFirecrawlApiKey(cfg)).toBe('fc-from-yaml');
    const meta = listExtractorMetadata(cfg);
    expect(meta.find((e) => e.name === 'jina')?.available).toBe(true);
    expect(meta.find((e) => e.name === 'firecrawl')?.available).toBe(true);
  });

  it('falls back to legacy extraction.* keys', () => {
    const cfg = {
      extraction: {
        jina_api_key: 'legacy-jina',
        firecrawl_api_key: 'legacy-fc',
      },
    };
    expect(resolveJinaApiKey(cfg)).toBe('legacy-jina');
    expect(resolveFirecrawlApiKey(cfg)).toBe('legacy-fc');
  });

  it('prefers web_extraction over legacy keys', () => {
    const cfg = {
      extraction: { jina_api_key: 'legacy-jina' },
      source_ingestion: {
        web_extraction: {
          jina: { api_key: 'yaml-jina' },
        },
      },
    };
    expect(resolveJinaApiKey(cfg)).toBe('yaml-jina');
  });

  it('honors enabled: false even when api_key is set', () => {
    const cfg = {
      source_ingestion: {
        web_extraction: {
          jina: { enabled: false, api_key: 'present' },
          firecrawl: { enabled: false, api_key: 'present' },
        },
      },
    };
    expect(isWebExtractorEnabled(cfg, 'jina')).toBe(false);
    expect(isWebExtractorEnabled(cfg, 'firecrawl')).toBe(false);
    const meta = listExtractorMetadata(cfg);
    expect(meta.find((e) => e.name === 'jina')?.available).toBe(false);
    expect(meta.find((e) => e.name === 'firecrawl')?.available).toBe(false);
  });

  it('treats blank api_key as unavailable', () => {
    const cfg = {
      source_ingestion: {
        web_extraction: {
          jina: { enabled: true, api_key: '   ' },
        },
      },
    };
    expect(resolveJinaApiKey(cfg)).toBeUndefined();
  });
});
