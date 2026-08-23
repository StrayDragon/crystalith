// Health dependency probing — business logic for /health/dependencies.
// Extracted from server.ts so the HTTP layer stays thin (elysia review A4).

import type { HealthDependencies } from '@crystalith/shared';

import { getOptionalServices } from './config.ts';
import { logger } from './logger.ts';
import { outboundFetch } from './net/outbound-fetch.ts';

/** Probe core + optional dependencies. Never throws — degradation is data. */
export async function probeHealthDependencies(): Promise<HealthDependencies> {
  const opt = getOptionalServices();
  const now = new Date().toISOString();

  // Probe SearXNG via same host as searchWeb (getSearxngHost SSOT).
  let searxngStatus: string;
  let searxngHealthy: boolean | null;
  if (opt.searxng.enabled && opt.searxng.endpoint) {
    try {
      const res = await outboundFetch(opt.searxng.endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout((opt.searxng.timeout_s ?? 3) * 1000),
      });
      searxngStatus = res.ok ? 'healthy' : 'degraded';
      searxngHealthy = res.ok;
    } catch {
      searxngStatus = 'degraded';
      searxngHealthy = false;
    }
  } else {
    searxngStatus = 'disabled';
    searxngHealthy = null;
  }

  if (searxngEnabledAndDegraded(opt.searxng.enabled, searxngStatus)) {
    logger.warn('optional dependency degraded', {
      service: 'searxng',
      endpoint: opt.searxng.endpoint,
    });
  }

  return {
    status: 'ok',
    generatedAt: now,
    lastProbe: now,
    core: {
      backend: { service: 'api', healthy: true },
      frontend: {
        service: 'web',
        healthy: null,
        note: 'frontend health is validated through reverse-proxy route /health',
      },
    },
    optional: {
      cacheRedis: {
        service: 'Redis (Cache)',
        enabled: false,
        endpoint: null,
        status: 'disabled',
        healthy: null,
      },
      searchSearxng: {
        service: 'SearXNG (Search)',
        enabled: opt.searxng.enabled,
        endpoint: opt.searxng.enabled ? (opt.searxng.endpoint ?? null) : null,
        status: searxngStatus,
        healthy: searxngHealthy,
      },
    },
  };
}

function searxngEnabledAndDegraded(enabled: boolean, status: string): boolean {
  return enabled && status === 'degraded';
}
