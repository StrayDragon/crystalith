// Tests for the template-rendering config loader.
import { afterEach, describe, expect, it } from "bun:test";
import { writeFileSync, rmSync } from "node:fs";

import { loadConfig, resetConfig, getModelById, getDefaultChatModel } from "../src/shared/config.ts";

const TMP = "data/test-config.yaml";

afterEach(() => {
  resetConfig();
  rmSync(TMP, { force: true });
});

describe("config: template rendering", () => {
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
    expect(cfg.models.defaults.chat).toBe("fallback-chat");
  });

  it("picks up env override when set", () => {
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
    process.env.MY_CHAT_OVERRIDE = "custom";
    const cfg = loadConfig(TMP);
    resetConfig(cfg);
    expect(cfg.models.defaults.chat).toBe("custom");
    expect(getModelById("custom")).toBeDefined();
    delete process.env.MY_CHAT_OVERRIDE;
  });

  it("validates models defaults exist in available", () => {
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

  it("returns empty config when file is missing", () => {
    const cfg = loadConfig("data/does-not-exist.yaml");
    expect(cfg.models.available).toEqual([]);
  });

  it("getDefaultChatModel falls back to first chat-role model", () => {
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
    expect(getDefaultChatModel()?.id).toBe("m1");
  });
});
