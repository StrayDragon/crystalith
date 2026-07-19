import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, expect, test } from 'vitest';

import { server } from '../../../../test-utils/msw/server';
import { renderHook } from '../../../../test-utils/renderHook';
import { toOptionalServiceDiagnostics, useDependencyHealth } from './useDependencyHealth';

function wrapSWR({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false }}>
      {children}
    </SWRConfig>
  );
}

beforeEach(() => {
  server.resetHandlers();
});

test('toOptionalServiceDiagnostics orders and normalizes optional services', () => {
  const diagnostics = toOptionalServiceDiagnostics({
    cacheRedis: {
      service: 'redis',
      enabled: true,
      status: 'degraded',
      healthy: false,
      error: 'boom',
    },
    searchSearxng: {
      service: 'searxng',
      enabled: true,
      status: 'healthy',
      healthy: true,
      endpoint: 'http://searx',
    },
  });

  expect(diagnostics.map((d) => d.key)).toEqual(['cacheRedis', 'searchSearxng']);
  expect(diagnostics[0]?.error).toBe('boom');
  expect(diagnostics[1]?.endpoint).toBe('http://searx');
});

test('useDependencyHealth fetches data and refresh updates from force endpoint', async () => {
  server.use(
    http.get('*/health/dependencies', ({ request }) => {
      const url = new URL(request.url);
      const forced = url.searchParams.get('force') === '1';

      return HttpResponse.json({
        status: 'ok',
        generatedAt: '2026-01-01T00:00:00Z',
        lastProbe: forced ? 'forced' : 'initial',
        core: {
          frontend: { service: 'web', healthy: true },
          backend: { service: 'api', healthy: true },
        },
        optional: {
          cacheRedis: {
            service: 'redis',
            enabled: true,
            status: forced ? 'degraded' : 'healthy',
            healthy: !forced,
            error: forced ? 'timeout' : null,
          },
          searchSearxng: { service: 'searxng', enabled: false, status: 'disabled', healthy: null },
        },
      });
    }),
  );

  const { result } = renderHook(() => useDependencyHealth({ enabled: true }), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(result.current.data?.lastProbe).toBe('initial');
  });
  expect(result.current.error).toBe('');
  expect(result.current.data?.optional.cacheRedis.status).toBe('healthy');

  await act(async () => {
    await result.current.refresh();
  });

  await waitFor(() => {
    expect(result.current.data?.lastProbe).toBe('forced');
  });
  expect(result.current.data?.optional.cacheRedis.status).toBe('degraded');
});
