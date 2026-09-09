import type { WorkspaceToolsSlidesDiagnostic } from '@crystalith/shared';

import { getSlidesPreview } from './config.ts';
import { logger } from './logger.ts';

// SLIDES availability probe (probe-slides-availability).
//
// The Slidev preview runs as an independent process (overmind `slidev` job in
// dev; often absent in minimal self-host / single-binary deployments). The
// host probes `<base_url>/slidev/` and exposes the result through
// `/v2/workspace/tools` → `diagnostics.slides` so the frontend can remove the
// SLIDES generate entry while the preview is unavailable (r272: the tools
// contract is the single availability source for the UI).
//
// Degradation is data, never an exception (same posture as health.ts). The
// result is cached briefly because tools is polled by SWR.

/** Stable errorCodes surfaced through diagnostics.slides.errorCode. */
export const SlidesErrorCode = {
  PLUGIN_MISSING: 'SLIDES_PLUGIN_MISSING',
  PREVIEW_UNREACHABLE: 'SLIDES_PREVIEW_UNREACHABLE',
  PREVIEW_DISABLED: 'SLIDES_PREVIEW_DISABLED',
} as const;

const PROBE_CACHE_TTL_MS = 10_000;

interface CacheEntry {
  at: number;
  diagnostic: WorkspaceToolsSlidesDiagnostic;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<WorkspaceToolsSlidesDiagnostic> | null = null;

/** Test seam — drop the TTL cache and any in-flight probe. */
export function resetSlidesProbeCache(): void {
  cache = null;
  inFlight = null;
}

/** Pure diagnostic builder: two failure layers, stable codes, actionable hint. */
export function buildSlidesDiagnostic(input: {
  pluginLoaded: boolean;
  probeAttempted: boolean;
  probeReachable: boolean;
}): WorkspaceToolsSlidesDiagnostic {
  const activePluginId = input.pluginLoaded ? 'slides-slidev' : null;
  if (!input.pluginLoaded) {
    return {
      available: false,
      message: 'slides workflow 插件未加载（slides-slidev）',
      hint: '检查 config/app.yaml 的 plugins 配置与插件加载诊断（diagnostics.plugins）',
      activePluginId: null,
      engine: null,
      errorCode: SlidesErrorCode.PLUGIN_MISSING,
    };
  }
  if (!input.probeAttempted) {
    return {
      available: false,
      message: 'slides_preview.base_url 为空，预览可用性探测已显式禁用',
      hint: '在 config/app.yaml 的 slides_preview.base_url 填入可达的 Slidev 实例地址即可重新启用 SLIDES 工具',
      activePluginId,
      engine: 'slidev',
      errorCode: SlidesErrorCode.PREVIEW_DISABLED,
    };
  }
  if (!input.probeReachable) {
    return {
      available: false,
      message: 'Slidev 预览进程不可达',
      hint: '启动 Slidev 预览（overmind: just dev 含 slidev 任务；或 cd packages/crystalith-slidev && bun dev），或把 slides_preview.base_url 指向可达实例',
      activePluginId,
      engine: 'slidev',
      errorCode: SlidesErrorCode.PREVIEW_UNREACHABLE,
    };
  }
  return {
    available: true,
    message: null,
    hint: null,
    activePluginId,
    engine: 'slidev',
    errorCode: null,
  };
}

/**
 * GET `<base_url>/slidev/` — any 2xx counts as reachable.
 *
 * Deliberately plain `fetch`, NOT `outboundFetch`: the preview is a local /
 * sidecar service, so it must stay direct even when `proxy_settings` is on —
 * routing loopback through an outbound proxy would silently fail the probe
 * unless the operator's no_proxy happens to cover it.
 */
async function probeSlidevReachable(baseUrl: string, timeoutMs: number): Promise<boolean> {
  const url = `${baseUrl.replace(/\/+$/u, '')}/slidev/`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Compute (with TTL cache + in-flight dedup) the diagnostics.slides blob.
 * `pluginLoaded` is resolved by the caller (workspace router already holds
 * the registry handle) so this module stays plugin-agnostic.
 */
export async function getSlidesDiagnostic(options: {
  pluginLoaded: boolean;
}): Promise<WorkspaceToolsSlidesDiagnostic> {
  const cached = cache;
  if (cached && Date.now() - cached.at < PROBE_CACHE_TTL_MS) return cached.diagnostic;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const preview = getSlidesPreview();
    const baseUrl = preview.base_url.trim();
    const probeAttempted = options.pluginLoaded && baseUrl !== '';
    let reachable = false;
    if (probeAttempted) {
      reachable = await probeSlidevReachable(baseUrl, preview.probe_timeout_ms);
      if (!reachable) {
        logger.info('slides preview probe unreachable', { baseUrl });
      }
    }
    const diagnostic = buildSlidesDiagnostic({
      pluginLoaded: options.pluginLoaded,
      probeAttempted,
      probeReachable: reachable,
    });
    cache = { at: Date.now(), diagnostic };
    return diagnostic;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
