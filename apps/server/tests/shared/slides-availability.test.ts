// SLIDES availability diagnostics (probe-slides-availability).
//
// Pure branch coverage for buildSlidesDiagnostic + router integration where a
// fake Slidev (Bun.serve on an ephemeral port) drives both availability layers:
// preview reachable → diagnostics.slides.available=true and SLIDES tool
// enabled; unreachable → structured diagnostic with stable errorCode and the
// tool disabled.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { createApp } from '../../src/server.ts';
import { resetConfig } from '../../src/shared/config.ts';
import {
  buildSlidesDiagnostic,
  getSlidesDiagnostic,
  resetSlidesProbeCache,
} from '../../src/shared/slides-availability.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let fakeSlidev: Bun.Server;
let fakePort: number;

const SEED_MODELS = {
  defaults: { chat: 'test-chat' },
  available: [
    {
      id: 'test-chat',
      provider: 'openai',
      model: 'gpt-4o-test',
      displayName: 'Test Chat',
      roles: ['chat'],
      capabilities: [],
      providerConfig: { apiKey: 'test-key' },
    },
  ],
};

beforeAll(() => {
  fakeSlidev = Bun.serve({
    port: 0,
    fetch: () => new Response('slidev stub'),
  });
  fakePort = fakeSlidev.port;
  app = createApp();
});

afterAll(() => {
  fakeSlidev.stop(true);
  resetConfig();
});

describe('buildSlidesDiagnostic (pure branches)', () => {
  it('plugin missing → SLIDES_PLUGIN_MISSING, no activePluginId', () => {
    const d = buildSlidesDiagnostic({
      pluginLoaded: false,
      probeAttempted: false,
      probeReachable: false,
    });
    expect(d.available).toBe(false);
    expect(d.errorCode).toBe('SLIDES_PLUGIN_MISSING');
    expect(d.activePluginId).toBeNull();
  });

  it('empty base_url → SLIDES_PREVIEW_DISABLED, probe skipped', () => {
    const d = buildSlidesDiagnostic({
      pluginLoaded: true,
      probeAttempted: false,
      probeReachable: false,
    });
    expect(d.available).toBe(false);
    expect(d.errorCode).toBe('SLIDES_PREVIEW_DISABLED');
    expect(d.activePluginId).toBe('slides-slidev');
    expect(d.engine).toBe('slidev');
  });

  it('unreachable → SLIDES_PREVIEW_UNREACHABLE with actionable hint', () => {
    const d = buildSlidesDiagnostic({
      pluginLoaded: true,
      probeAttempted: true,
      probeReachable: false,
    });
    expect(d.available).toBe(false);
    expect(d.errorCode).toBe('SLIDES_PREVIEW_UNREACHABLE');
    expect(d.hint).toContain('Slidev');
  });

  it('reachable → available with null error fields', () => {
    const d = buildSlidesDiagnostic({
      pluginLoaded: true,
      probeAttempted: true,
      probeReachable: true,
    });
    expect(d.available).toBe(true);
    expect(d.errorCode).toBeNull();
    expect(d.message).toBeNull();
    expect(d.hint).toBeNull();
  });
});

describe('getSlidesDiagnostic cache semantics', () => {
  it('serves the cached diagnostic within TTL (same object identity)', async () => {
    resetConfig({
      models: SEED_MODELS,
      raw: { slides_preview: { base_url: `http://127.0.0.1:${fakePort}`, probe_timeout_ms: 500 } },
    });
    resetSlidesProbeCache();
    const first = await getSlidesDiagnostic({ pluginLoaded: true });
    const second = await getSlidesDiagnostic({ pluginLoaded: true });
    expect(second).toBe(first);
  });

  it('dedups concurrent probes into one in-flight request', async () => {
    resetConfig({
      models: SEED_MODELS,
      raw: { slides_preview: { base_url: `http://127.0.0.1:${fakePort}`, probe_timeout_ms: 500 } },
    });
    resetSlidesProbeCache();
    const [a, b] = await Promise.all([
      getSlidesDiagnostic({ pluginLoaded: true }),
      getSlidesDiagnostic({ pluginLoaded: true }),
    ]);
    expect(b).toBe(a);
  });
});

describe('workspace tools slides diagnostics (integration)', () => {
  it('preview reachable → diagnostics.slides.available and SLIDES tool enabled', async () => {
    resetConfig({
      models: SEED_MODELS,
      raw: { slides_preview: { base_url: `http://127.0.0.1:${fakePort}`, probe_timeout_ms: 500 } },
    });
    resetSlidesProbeCache();
    const res = await app.handle(new Request(`${BASE}/v2/workspace/tools`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tools: Array<{ outputType: string; enabled: boolean }>;
      diagnostics: {
        slides: { available: boolean; errorCode: string | null; activePluginId: string | null };
      };
    };
    expect(body.diagnostics.slides.available).toBe(true);
    expect(body.diagnostics.slides.activePluginId).toBe('slides-slidev');
    const slides = body.tools.find((t) => t.outputType === 'SLIDES');
    expect(slides?.enabled).toBe(true);
    const briefing = body.tools.find((t) => t.outputType === 'BRIEFING');
    expect(briefing?.enabled).toBe(true);
  });

  it('preview unreachable → available=false, stable errorCode, SLIDES tool disabled', async () => {
    // Port 1 on loopback refuses connections immediately — no timeout wait.
    resetConfig({
      models: SEED_MODELS,
      raw: { slides_preview: { base_url: 'http://127.0.0.1:1', probe_timeout_ms: 500 } },
    });
    resetSlidesProbeCache();
    const res = await app.handle(new Request(`${BASE}/v2/workspace/tools`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tools: Array<{ outputType: string; enabled: boolean }>;
      diagnostics: {
        slides: { available: boolean; errorCode: string | null; hint: string | null };
      };
    };
    expect(body.diagnostics.slides.available).toBe(false);
    expect(body.diagnostics.slides.errorCode).toBe('SLIDES_PREVIEW_UNREACHABLE');
    expect(body.diagnostics.slides.hint).toContain('Slidev');
    const slides = body.tools.find((t) => t.outputType === 'SLIDES');
    expect(slides?.enabled).toBe(false);
    // Other tools are unaffected by the slides probe.
    const briefing = body.tools.find((t) => t.outputType === 'BRIEFING');
    expect(briefing?.enabled).toBe(true);
  });
});
