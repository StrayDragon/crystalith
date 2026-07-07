// Cross-cutting smoke tests for the shared Zod schemas SSOT.
// Guards against drift between the server route layer and the frontend eden
// treaty client — both consume these schemas directly.
import { describe, expect, it } from "bun:test";

import * as S from "../src/index.ts";

describe("common schemas", () => {
  it("parses an error envelope", () => {
    const ee = S.ErrorEnvelopeSchema.parse({ error_code: "BAD", message: "nope" });
    expect(ee.error_code).toBe("BAD");
    expect(ee.details).toBeUndefined();
  });

  it("parses pagination params with coercion + defaults", () => {
    const p = S.PaginationParamsSchema.parse({ offset: "5", limit: "10" });
    expect(p).toEqual({ offset: 5, limit: 10 });
    expect(S.PaginationParamsSchema.parse({}).limit).toBe(20);
  });

  it("wraps items in a paginated envelope", () => {
    const Page = S.PaginatedSchema(S.IdSchema);
    const out = Page.parse({ items: [1, 2], total: 2, offset: 0, limit: 20 });
    expect(out.items).toEqual([1, 2]);
  });

  it("parses a citation with optional fields", () => {
    const c = S.CitationSchema.parse({
      source_id: 1,
      source_name: "doc",
      chunk_id: 3,
      chunk_index: 0,
      snippet: "hello",
    });
    expect(c.score).toBeUndefined();
    expect(c.page_number).toBeUndefined();
  });
});

describe("domain schemas", () => {
  it("notebook create trims-free validation", () => {
    expect(S.NotebookCreateSchema.safeParse({ name: "" }).success).toBe(false);
    expect(S.NotebookCreateSchema.safeParse({ name: "x".repeat(300) }).success).toBe(false);
    expect(S.NotebookCreateSchema.parse({ name: "OK" }).name).toBe("OK");
  });

  it("output typed union discriminates by type", () => {
    const faq = S.TypedOutputContentSchema.parse({
      type: "FAQ",
      items: [{ question: "Q", answer: "A" }],
    });
    expect(faq.type).toBe("FAQ");

    const tl = S.TypedOutputContentSchema.parse({
      type: "TIMELINE",
      events: [{ date: "2026", event: "v2", description: "rewrite" }],
    });
    expect(tl.type).toBe("TIMELINE");
    expect(tl.events).toHaveLength(1);
  });

  it("mindmap content is recursive", () => {
    const mm = S.MindmapContentSchema.parse({
      root: { label: "r", children: [{ label: "c", children: [{ label: "leaf" }] }] },
    });
    expect(mm.root.children?.[0]?.children?.[0]?.label).toBe("leaf");
  });

  it("model settings reject a default not in available", () => {
    const bad = S.ModelsSettingsSchema.safeParse({ defaults: { chat: "ghost" }, available: [] });
    expect(bad.success).toBe(false);
  });

  it("source-from-url request normalizes the extractor + requires http(s)", () => {
    const ok = S.SourceFromUrlRequestSchema.parse({
      url: "https://example.com/a",
      mode: "fetch",
      extractor: "JINA",
    });
    expect(ok.extractor).toBe("jina");
    expect(S.SourceFromUrlRequestSchema.safeParse({ url: "ftp://x" }).success).toBe(false);
  });

  it("qa stream request has sensible defaults", () => {
    const r = S.QaStreamRequestSchema.parse({
      session_id: 1,
      question: "hi",
    });
    expect(r.history).toEqual([]);
    expect(r.question).toBe("hi");
  });

  it("research progress event union discriminates", () => {
    const ev = S.ResearchProgressEventSchema.parse({
      event: "plan_ready",
      session_id: 1,
      plan: { iteration: 1, queries: [], reasoning: "", estimated_results: 5 },
    });
    expect(ev.event).toBe("plan_ready");
  });

  it("eval metrics enforce 0..1 bounds", () => {
    expect(
      S.EvalMetricsSchema.safeParse({
        faithfulness: 1.5,
        relevance: 0.5,
        latency_ms: 10,
      }).success,
    ).toBe(false);
  });
});
