// Tests for the template-rendering config loader.
import { afterEach, describe, expect, it } from 'bun:test';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  loadConfig,
  resetConfig,
  getModelById,
  getDefaultChatModel,
  getSecurityPolicy,
  getUploadMaxBytes,
  getAiSettings,
  getConcurrencySettings,
  getEmbeddingSettings,
  getContextWindowSettings,
  getSearchSettings,
  getSearxngHost,
  getCompletionOptions,
} from '../src/shared/config.ts';

const TMP = join(tmpdir(), `crystalith-test-config-${process.pid}.yaml`);

afterEach(() => {
  resetConfig();
  rmSync(TMP, { force: true });
  delete process.env.CL_SEARXNG_HOST;
  delete process.env.SEARXNG_HOST;
  delete process.env.MY_CHAT_OVERRIDE;
});

describe('config: template rendering', () => {
  it("renders {{ env.KEY | default('x') }} expressions", () => {
    writeFileSync(
      TMP,
      `name: test
models:
  defaults:
    chat: "{{ env.MY_CHAT | default('fallback-chat') }}"
  available:
    - id: "fallback-chat"
      provider: "openai"
      model: "gpt-4o"
      display_name: "Fallback"
      roles: [chat]
`,
    );
    process.env.MY_CHAT = undefined;
    const cfg = loadConfig(TMP);
    expect(cfg.models.defaults.chat).toBe('fallback-chat');
  });

  it('picks up env override when set', () => {
    writeFileSync(
      TMP,
      `models:
  defaults:
    chat: "{{ env.MY_CHAT_OVERRIDE | default('fb') }}"
  available:
    - id: "fb"
      provider: "openai"
      model: "m"
      display_name: "F"
      roles: [chat]
    - id: "custom"
      provider: "openai"
      model: "m2"
      display_name: "C"
      roles: [chat]
`,
    );
    process.env.MY_CHAT_OVERRIDE = 'custom';
    const cfg = loadConfig(TMP);
    resetConfig(cfg);
    expect(cfg.models.defaults.chat).toBe('custom');
    expect(getModelById('custom')).toBeDefined();
    delete process.env.MY_CHAT_OVERRIDE;
  });

  it('validates models defaults exist in available', () => {
    writeFileSync(
      TMP,
      `models:
  defaults:
    chat: "nonexistent"
  available: []
`,
    );
    expect(() => loadConfig(TMP)).toThrow();
  });

  it('returns empty config when file is missing', () => {
    const cfg = loadConfig('data/does-not-exist.yaml');
    expect(cfg.models.available).toEqual([]);
  });

  it('getDefaultChatModel falls back to first chat-role model', () => {
    writeFileSync(
      TMP,
      `models:
  defaults: {}
  available:
    - id: "m1"
      provider: "openai"
      model: "gpt"
      display_name: "M1"
      roles: [chat]
`,
    );
    const cfg = loadConfig(TMP);
    resetConfig(cfg);
    expect(getDefaultChatModel()?.id).toBe('m1');
  });
});

// ---------------------------------------------------------------------------
// c25: SSRF security policy + upload max bytes config parsing
// ---------------------------------------------------------------------------

describe('config: security policy parsing', () => {
  it('returns empty policy when security section is absent', () => {
    writeFileSync(
      TMP,
      `models:
  defaults: {}
  available: []
`,
    );
    resetConfig(loadConfig(TMP));
    // Now returns typed defaults instead of empty object (c63+ typed accessor).
    expect(getSecurityPolicy()).toEqual({
      allowlistOnly: false,
      hostAllowlist: undefined,
      domainAllowlist: undefined,
      cidrAllowlist: undefined,
      maxRedirects: 5,
    });
  });

  it('parses allowlist_hosts as string array', () => {
    writeFileSync(
      TMP,
      `models:
  defaults: {}
  available: []
source_ingestion:
  url_fetch:
    security:
      allowlist_hosts:
        - example.com
        - trusted.org
`,
    );
    resetConfig(loadConfig(TMP));
    const policy = getSecurityPolicy();
    expect(policy.hostAllowlist).toEqual(['example.com', 'trusted.org']);
  });

  it('parses allowlist_only flag', () => {
    writeFileSync(
      TMP,
      `models:
  defaults: {}
  available: []
source_ingestion:
  url_fetch:
    security:
      allowlist_only: true
`,
    );
    resetConfig(loadConfig(TMP));
    expect(getSecurityPolicy().allowlistOnly).toBe(true);
  });

  it('parses cidrAllowlist', () => {
    writeFileSync(
      TMP,
      `models:
  defaults: {}
  available: []
source_ingestion:
  url_fetch:
    security:
      allowlist_cidrs:
        - "10.0.0.0/8"
        - "192.168.0.0/16"
`,
    );
    resetConfig(loadConfig(TMP));
    expect(getSecurityPolicy().cidrAllowlist).toEqual(['10.0.0.0/8', '192.168.0.0/16']);
  });
});

describe('config: upload max bytes', () => {
  it('returns 50 MB when config is absent', () => {
    writeFileSync(
      TMP,
      `models:
  defaults: {}
  available: []
`,
    );
    resetConfig(loadConfig(TMP));
    expect(getUploadMaxBytes()).toBe(50 * 1024 * 1024);
  });

  it('reads upload_max_bytes from app.http_guardrails', () => {
    writeFileSync(
      TMP,
      `models:
  defaults: {}
  available: []
app:
  http_guardrails:
    upload_max_bytes: 1048576
`,
    );
    resetConfig(loadConfig(TMP));
    expect(getUploadMaxBytes()).toBe(1048576);
  });
});

// ---------------------------------------------------------------------------
// c40: AI / concurrency / embedding / search / completion_options config
// ---------------------------------------------------------------------------

describe('config: c40 typed sections', () => {
  it('returns defaults when sections are absent', () => {
    writeFileSync(TMP, `models:\n  defaults: {}\n  available: []\n`);
    resetConfig(loadConfig(TMP));
    expect(getAiSettings()).toEqual({ timeout: 60, max_retries: 3 });
    expect(getConcurrencySettings()).toEqual({ embedding: 8, vector_search: 8, llm_generate: 4 });
    expect(getEmbeddingSettings()).toEqual({ chunk_size: 512, batch_size: 32 });
    expect(getContextWindowSettings().max_tokens).toBe(8000);
    expect(getCompletionOptions()).toEqual({});
  });

  it('parses ai section', () => {
    writeFileSync(
      TMP,
      `models:
  defaults: {}
  available: []
ai:
  timeout: 120
  max_retries: 5
`,
    );
    resetConfig(loadConfig(TMP));
    expect(getAiSettings()).toEqual({ timeout: 120, max_retries: 5 });
  });

  it('parses concurrency section', () => {
    writeFileSync(
      TMP,
      `models:
  defaults: {}
  available: []
concurrency:
  embedding: 4
  vector_search: 6
  llm_generate: 2
`,
    );
    resetConfig(loadConfig(TMP));
    expect(getConcurrencySettings()).toEqual({ embedding: 4, vector_search: 6, llm_generate: 2 });
  });

  it('parses embedding section', () => {
    writeFileSync(
      TMP,
      `models:
  defaults: {}
  available: []
embedding:
  chunk_size: 800
  batch_size: 64
`,
    );
    resetConfig(loadConfig(TMP));
    expect(getEmbeddingSettings()).toEqual({ chunk_size: 800, batch_size: 64 });
  });

  it('parses search.searxng section (v1 key path, not search_engine)', () => {
    writeFileSync(
      TMP,
      `models:
  defaults: {}
  available: []
search:
  searxng:
    host: http://my-searxng:8080
    max_results: 5
`,
    );
    resetConfig(loadConfig(TMP));
    const search = getSearchSettings();
    expect(search.searxng.host).toBe('http://my-searxng:8080');
    expect(search.searxng.max_results).toBe(5);
    expect(getSearxngHost()).toBe('http://my-searxng:8080');
  });

  it('getSearxngHost falls back to env when config host is empty', () => {
    writeFileSync(TMP, `models:\n  defaults: {}\n  available: []\n`);
    resetConfig(loadConfig(TMP));
    delete process.env.CL_SEARXNG_HOST;
    process.env.SEARXNG_HOST = 'http://env-host:9090';
    expect(getSearxngHost()).toBe('http://env-host:9090');
  });

  it('parses completion_options section', () => {
    writeFileSync(
      TMP,
      `models:
  defaults: {}
  available: []
completion_options:
  temperature: 0.7
  top_p: 0.9
  stop: ["\\n\\n"]
`,
    );
    resetConfig(loadConfig(TMP));
    const co = getCompletionOptions();
    expect(co.temperature).toBe(0.7);
    expect(co.top_p).toBe(0.9);
    expect(co.stop).toEqual(['\n\n']);
  });

  it('returns defaults on invalid values (safeParse fallback)', () => {
    writeFileSync(
      TMP,
      `models:
  defaults: {}
  available: []
ai:
  timeout: -5
  max_retries: "not-a-number"
`,
    );
    resetConfig(loadConfig(TMP));
    // Invalid values fall back to defaults
    expect(getAiSettings()).toEqual({ timeout: 60, max_retries: 3 });
  });
});
