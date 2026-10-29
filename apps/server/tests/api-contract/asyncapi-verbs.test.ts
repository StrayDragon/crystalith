// covers: r195（openapi-and-client-generation）
import { describe, expect, it } from 'bun:test';

// AsyncAPI parity gate — 原「手写字面量镜像」用例（逐 channel 复读 asyncapi.ts 的
// address/method）已删：asyncapi.ts 改它跟着改，真实路由改它不红。改为与
// openapi-generation.test.ts 同款 route↔doc 双向 parity，直接解析生成文档的
// wire 形态（channels map + http bindings）。
import { generateAsyncApiDocument } from '../../src/asyncapi.ts';
import { createApp } from '../../src/server.ts';

interface RouteShape {
  method: string;
  path: string;
}

interface DocChannel {
  address: string;
  bindings?: { http?: { method?: string } };
  messages?: Record<string, unknown>;
}

/** Elysia `:param` → AsyncAPI `{param}`，使两侧地址可比较。 */
function normalizeRoutePath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function collectRouteKeys(): string[] {
  return createApp()
    .routes.map((r: RouteShape) => `${r.method.toUpperCase()} ${normalizeRoutePath(r.path)}`)
    .sort();
}

function loadDocChannels(): Array<{ name: string; key: string; events: string[] }> {
  const doc = generateAsyncApiDocument() as { channels: Record<string, DocChannel> };
  return Object.entries(doc.channels).map(([name, ch]) => ({
    name,
    key: `${(ch.bindings?.http?.method ?? 'GET').toUpperCase()} ${ch.address}`,
    events: Object.keys(ch.messages ?? {}),
  }));
}

describe('AsyncAPI stream verbs', () => {
  it('documents every real SSE route (route → channel parity)', () => {
    const channelKeys = new Set(loadDocChannels().map((c) => c.key));
    // SSE 路由即以 /stream 结尾的路由——新增 SSE 路由必须同时登记 AsyncAPI channel。
    const undocumented = collectRouteKeys().filter(
      (key) => key.split(' ')[1].endsWith('/stream') && !channelKeys.has(key),
    );
    expect(undocumented).toEqual([]);
  });

  it('every channel points at a real route with a declared method (channel → route parity)', () => {
    const routeKeys = new Set(collectRouteKeys());
    const phantom = loadDocChannels().filter((c) => !routeKeys.has(c.key));
    expect(phantom.map((c) => c.key)).toEqual([]);
  });

  it('each channel declares at least one message', () => {
    for (const ch of loadDocChannels()) {
      expect(ch.name).toBeTruthy();
      expect(ch.events.length).toBeGreaterThan(0);
    }
  });
});
