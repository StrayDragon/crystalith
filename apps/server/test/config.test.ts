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
} from '../src/shared/config.ts';

const TMP = join(tmpdir(), `crystalith-test-config-${process.pid}.yaml`);

afterEach(() => {
  resetConfig();
  rmSync(TMP, { force: true });
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
    expect(getSecurityPolicy()).toEqual({});
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
