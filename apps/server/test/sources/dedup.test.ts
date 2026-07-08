// Tests for source deduplication helpers.
import { describe, expect, it } from 'bun:test';

import { uploadDedupKey, urlDedupKey, resolveDedupAction } from '../../src/features/sources/dedup.ts';
import { canonicalizeUrlForDedup } from '../../src/shared/net/url-normalize.ts';

// ---------------------------------------------------------------------------
// Dedup key computation
// ---------------------------------------------------------------------------

describe('uploadDedupKey', () => {
  it('produces a key with upload:sha256: prefix', () => {
    const key = uploadDedupKey(new TextEncoder().encode('hello world'));
    expect(key).toStartWith('upload:sha256:');
  });

  it('same content produces same key', () => {
    const a = uploadDedupKey(new TextEncoder().encode('same content'));
    const b = uploadDedupKey(new TextEncoder().encode('same content'));
    expect(a).toBe(b);
  });

  it('different content produces different keys', () => {
    const a = uploadDedupKey(new TextEncoder().encode('content a'));
    const b = uploadDedupKey(new TextEncoder().encode('content b'));
    expect(a).not.toBe(b);
  });
});

describe('urlDedupKey', () => {
  it('produces a key with url:sha256: prefix', () => {
    const key = urlDedupKey('https://example.com/page');
    expect(key).toStartWith('url:sha256:');
  });

  it('normalizes URL before hashing', () => {
    const a = urlDedupKey('https://example.com/page?utm_source=twitter');
    const b = urlDedupKey('https://example.com/page');
    expect(a).toBe(b);
  });

  it('different paths produce different keys', () => {
    const a = urlDedupKey('https://example.com/a');
    const b = urlDedupKey('https://example.com/b');
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// URL canonicalization
// ---------------------------------------------------------------------------

describe('canonicalizeUrlForDedup', () => {
  it('removes utm tracking params', () => {
    const result = canonicalizeUrlForDedup(
      'https://example.com/page?utm_source=twitter&utm_medium=social&id=123',
    );
    expect(result).not.toContain('utm_source');
    expect(result).not.toContain('utm_medium');
    expect(result).toContain('id=123');
  });

  it('lowercases hostname', () => {
    const result = canonicalizeUrlForDedup('https://Example.COM/Path');
    expect(result).toContain('example.com');
  });

  it('removes default ports', () => {
    const result = canonicalizeUrlForDedup('https://example.com:443/page');
    expect(result).not.toContain(':443');
  });

  it('removes fragment', () => {
    const result = canonicalizeUrlForDedup('https://example.com/page#section');
    expect(result).not.toContain('#section');
  });

  it('sorts query params', () => {
    const result = canonicalizeUrlForDedup('https://example.com/?b=2&a=1');
    expect(result.indexOf('a=1')).toBeLessThan(result.indexOf('b=2'));
  });
});

// ---------------------------------------------------------------------------
// SSRF validation (async — throws on invalid URLs)
// ---------------------------------------------------------------------------

// We test validateUrlForFetch with the async API since it resolves DNS.
// Skipping the full test for now as it requires DNS resolution and private-ip
// which may behave differently in the test environment.
// See url-safety.ts for the full implementation.

describe('validateUrlForFetch', async () => {
  const { validateUrlForFetch, SsrfBlockedError } = await import(
    '../../src/shared/net/url-safety.ts'
  );

  it('allows public HTTPS URLs', async () => {
    await expect(validateUrlForFetch('https://example.com/page')).resolves.toBeUndefined();
  });

  it('blocks file:// scheme', async () => {
    await expect(validateUrlForFetch('file:///etc/passwd')).rejects.toThrow(SsrfBlockedError);
  });

  it('blocks URL with userinfo', async () => {
    await expect(validateUrlForFetch('https://user:pass@example.com/')).rejects.toThrow(
      SsrfBlockedError,
    );
  });
});
