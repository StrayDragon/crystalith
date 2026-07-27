import { describe, expect, it } from 'bun:test';

import type { ProxySettings } from '../../src/shared/config.ts';
import { hostMatchesNoProxy, resolveOutboundProxy } from '../../src/shared/net/outbound-fetch.ts';

function settings(partial: Partial<ProxySettings>): ProxySettings {
  return {
    enabled: false,
    http_url: '',
    https_url: '',
    socks5_url: '',
    no_proxy: ['localhost', '127.0.0.1'],
    ...partial,
  };
}

describe('resolveOutboundProxy (c109)', () => {
  it('returns undefined when disabled', () => {
    expect(
      resolveOutboundProxy(
        'https://api.firecrawl.dev/v2/scrape',
        settings({
          enabled: false,
          https_url: 'http://proxy.example:8080',
        }),
      ),
    ).toBeUndefined();
  });

  it('skips hosts in no_proxy', () => {
    expect(
      resolveOutboundProxy(
        'http://127.0.0.1:8080/search',
        settings({
          enabled: true,
          http_url: 'http://proxy.example:8080',
          no_proxy: ['localhost', '127.0.0.1'],
        }),
      ),
    ).toBeUndefined();
  });

  it('uses https_url for https targets', () => {
    expect(
      resolveOutboundProxy(
        'https://api.firecrawl.dev/v2/scrape',
        settings({
          enabled: true,
          http_url: 'http://http-proxy:1',
          https_url: 'http://https-proxy:2',
        }),
      ),
    ).toBe('http://https-proxy:2');
  });

  it('falls back to http_url when https_url empty', () => {
    expect(
      resolveOutboundProxy(
        'https://r.jina.ai/https://example.com',
        settings({
          enabled: true,
          http_url: 'http://http-proxy:1',
          https_url: '',
        }),
      ),
    ).toBe('http://http-proxy:1');
  });

  it('uses http_url for http targets', () => {
    expect(
      resolveOutboundProxy(
        'http://searx.example/search',
        settings({
          enabled: true,
          http_url: 'http://http-proxy:1',
          https_url: 'http://https-proxy:2',
        }),
      ),
    ).toBe('http://http-proxy:1');
  });

  it('ignores socks5_url (c109)', () => {
    expect(
      resolveOutboundProxy(
        'https://example.com',
        settings({
          enabled: true,
          socks5_url: 'socks5://sock:1080',
          http_url: '',
          https_url: '',
        }),
      ),
    ).toBeUndefined();
  });
});

describe('hostMatchesNoProxy', () => {
  it('matches exact and suffix forms', () => {
    expect(hostMatchesNoProxy('localhost', 'localhost')).toBe(true);
    expect(hostMatchesNoProxy('api.internal.example', '.example')).toBe(true);
    expect(hostMatchesNoProxy('api.internal.example', 'example')).toBe(true);
    expect(hostMatchesNoProxy('evil.com', 'example')).toBe(false);
  });
});
