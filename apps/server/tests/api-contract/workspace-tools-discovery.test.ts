// covers: r322
// 生成类型的注册与发现：内置生成类型在系统启动时装载（OUTPUT_META 注册表），
// GET /v2/workspace/tools 以统一方式向调用方发现该集合 —
// 工具列表 MUST 与注册表一一对应（id/kind/label/outputType/renderDescriptor/
// frontendBundle/enabled），且响应通过 shared WorkspaceToolsListResponseSchema。
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { WorkspaceToolsListResponseSchema } from '@crystalith/shared';

import { FRONTEND_BUNDLES, OUTPUT_META } from '../../src/features/outputs/generator.ts';
import { createApp } from '../../src/server.ts';
import { resetConfig } from '../../src/shared/config.ts';
import { resetSlidesProbeCache } from '../../src/shared/slides-availability.ts';
import { setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';

let app: InstanceType<typeof createApp>;

beforeAll(() => {
  setupIntegrationEnv();
  // Pin the Slidev preview probe to a refused loopback port for determinism
  // （SLIDES enabled=false，其余工具照常发现）。
  resetConfig({
    models: { defaults: {}, available: [] },
    raw: { slides_preview: { base_url: 'http://127.0.0.1:1', probe_timeout_ms: 500 } },
  });
  resetSlidesProbeCache();
  app = createApp();
});

afterAll(() => {
  teardownIntegrationEnv();
  resetConfig();
});

describe('workspace tools discover the registered generation types (r322)', () => {
  it('registration table is loaded at startup with the built-in set', () => {
    const registered = Object.keys(OUTPUT_META);
    expect(registered.length).toBeGreaterThanOrEqual(10);
    for (const builtIn of [
      'FAQ',
      'GUIDE',
      'TIMELINE',
      'MINDMAP',
      'QUIZ',
      'BRIEFING',
      'SLIDES',
      'PARAGRAPH',
      'BULLETS',
      'STRUCTURED',
    ]) {
      expect(registered).toContain(builtIn);
    }
  });

  it('GET /v2/workspace/tools discovers exactly the registered set with mapped metadata', async () => {
    const res = await app.handle(new Request(`${BASE}/v2/workspace/tools`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tools: Array<Record<string, unknown>> };

    // 响应符合 shared wire 契约
    expect(WorkspaceToolsListResponseSchema.safeParse(body).success).toBe(true);

    const tools = body.tools;
    // 发现集合 === 注册集合（无多、无少）
    expect(tools.map((t) => t.id).sort()).toEqual(
      Object.keys(OUTPUT_META)
        .map((type) => type.toLowerCase())
        .sort(),
    );

    for (const tool of tools) {
      const type = String(tool.outputType);
      const meta = OUTPUT_META[type]!;
      expect(tool.kind).toBe('outputType');
      expect(type).toBe(type.toUpperCase());
      expect(tool.label).toBe(meta.displayText);
      expect(tool.description).toBe(meta.description);
      expect(tool.prompt).toBe(meta.prompt);
      expect(tool.isTool).toBe(meta.isTool);
      expect(tool.renderDescriptor).toEqual(meta.renderDescriptor);
      expect(tool.frontendBundle).toEqual(
        FRONTEND_BUNDLES[type as keyof typeof FRONTEND_BUNDLES] ?? null,
      );
      // enabled 为布尔（SLIDES 依赖预览可达性，此处探针被钉死为不可达）
      expect(typeof tool.enabled === 'boolean').toBe(true);
    }

    const byId = new Map(tools.map((t) => [t.id, t]));
    expect((byId.get('slides') as Record<string, unknown>).enabled).toBe(false);
    expect((byId.get('faq') as Record<string, unknown>).enabled).toBe(true);
  });
});
