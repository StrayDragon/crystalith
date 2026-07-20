// Tests for SSRF guard — allowlist enforcement (non-network paths).
// The hostname→DNS path requires network; these tests cover the IP-literal and
// allowlist-only branches that resolve without DNS.
import { describe, expect, it } from 'bun:test';

import { SsrfBlockedError, validateUrlForFetch } from '../../src/shared/net/url-safety.ts';

describe('validateUrlForFetch — scheme/userinfo/port', () => {
  it('blocks non-http schemes', async () => {
    await expect(validateUrlForFetch('file:///etc/passwd')).rejects.toThrow(SsrfBlockedError);
  });

  it('blocks userinfo', async () => {
    await expect(validateUrlForFetch('https://user:pass@example.com/')).rejects.toThrow(
      SsrfBlockedError,
    );
  });
});

describe('validateUrlForFetch — IP-literal allowlist (no DNS)', () => {
  it('blocks private IP literal even without policy', async () => {
    await expect(validateUrlForFetch('http://10.0.0.1/')).rejects.toThrow(SsrfBlockedError);
  });

  it('allows a public IP literal not in allowlist-only mode', async () => {
    // 8.8.8.8 is public; no policy → allowed.
    await expect(validateUrlForFetch('http://8.8.8.8/')).resolves.toBeUndefined();
  });

  it('allowlist-only blocks a public IP not in the CIDR allowlist', async () => {
    await expect(
      validateUrlForFetch('http://8.8.8.8/', {
        allowlistOnly: true,
        cidrAllowlist: ['1.1.1.1/32'],
      }),
    ).rejects.toThrow(SsrfBlockedError);
  });

  it('allowlist-only allows a public IP inside the CIDR allowlist', async () => {
    await expect(
      validateUrlForFetch('http://8.8.8.8/', {
        allowlistOnly: true,
        cidrAllowlist: ['8.8.8.0/24'],
      }),
    ).resolves.toBeUndefined();
  });
});
