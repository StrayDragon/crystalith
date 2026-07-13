// Tests for fetchWithRedirectGuard — per-hop SSRF redirect validation (P0-3).
// Mocks global.fetch so no real network calls happen; asserts that redirect
// chains are walked manually and every Location is re-validated.
import { afterEach, describe, expect, it, mock } from 'bun:test';

import { fetchWithRedirectGuard } from '../../src/shared/net/fetch-with-redirect-guard.ts';
import { SsrfBlockedError } from '../../src/shared/net/url-safety.ts';

const originalFetch = globalThis.fetch;

function mockFetch(sequence: { status: number; location?: string; body?: string }[]) {
  let i = 0;
  const calls: string[] = [];
  const fn = mock(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push(String(url));
    // The guard always passes redirect: 'manual'; respect that here.
    void init;
    const step = sequence[Math.min(i, sequence.length - 1)];
    i++;
    const headers = new Headers();
    if (step.location) headers.set('location', step.location);
    return new Response(step.body ?? '', { status: step.status, headers });
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { fn, calls };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('fetchWithRedirectGuard — per-hop SSRF validation', () => {
  it('returns the response directly on a non-redirect (no hops)', async () => {
    const { fn } = mockFetch([{ status: 200, body: '<html>ok</html>' }]);
    const res = await fetchWithRedirectGuard('https://93.184.216.34/example.com', {});
    expect(fn).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<html>ok</html>');
  });

  it('follows a safe redirect chain and validates each hop', async () => {
    const { calls } = mockFetch([
      { status: 302, location: 'https://93.184.216.34/dest' },
      { status: 200, body: 'final' },
    ]);
    const res = await fetchWithRedirectGuard('https://93.184.216.34/start', {});
    expect(await res.text()).toBe('final');
    expect(calls).toEqual(['https://93.184.216.34/start', 'https://93.184.216.34/dest']);
  });

  it('blocks a redirect to the cloud metadata IP (169.254.169.254)', async () => {
    mockFetch([{ status: 302, location: 'http://169.254.169.254/latest/meta-data/' }]);
    await expect(fetchWithRedirectGuard('https://93.184.216.34/open-redirect', {})).rejects.toThrow(
      SsrfBlockedError,
    );
  });

  it('blocks a redirect to a private IP (192.168.x.x)', async () => {
    mockFetch([{ status: 301, location: 'http://192.168.1.1/admin' }]);
    await expect(fetchWithRedirectGuard('https://93.184.216.34/start', {})).rejects.toThrow(
      SsrfBlockedError,
    );
  });

  it('blocks the initial URL before any fetch when it is a private IP', async () => {
    const { fn } = mockFetch([{ status: 200 }]);
    await expect(fetchWithRedirectGuard('http://10.0.0.1/internal', {})).rejects.toThrow(
      SsrfBlockedError,
    );
    expect(fn).not.toHaveBeenCalled();
  });

  it('rejects when too many redirects are followed', async () => {
    // Always 302 → loop until maxRedirects exceeded.
    mockFetch([{ status: 302, location: 'https://93.184.216.34/loop' }]);
    await expect(
      fetchWithRedirectGuard('https://93.184.216.34/start', { maxRedirects: 2 }),
    ).rejects.toThrow(/Too many redirects/);
  });

  it('rejects a redirect without a Location header', async () => {
    mockFetch([{ status: 302 /* no location */ }]);
    await expect(fetchWithRedirectGuard('https://93.184.216.34/start', {})).rejects.toThrow(
      /without Location header/,
    );
  });

  it('resolves a relative Location against the current URL', async () => {
    const { calls } = mockFetch([
      { status: 302, location: '/deep/path' },
      { status: 200, body: 'ok' },
    ]);
    const res = await fetchWithRedirectGuard('https://93.184.216.34/start', {});
    expect(await res.text()).toBe('ok');
    expect(calls).toEqual(['https://93.184.216.34/start', 'https://93.184.216.34/deep/path']);
  });
});
