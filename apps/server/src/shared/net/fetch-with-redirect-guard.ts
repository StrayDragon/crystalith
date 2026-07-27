// SSRF-safe fetch that validates EVERY redirect hop (not just the initial URL).
//
// Mirrors v1 shared/extraction/trafilatura_extractor.py:178-213 which disables
// auto-redirect, walks the 3xx chain manually, and calls validate_url_for_fetch
// on the initial URL and on every Location header before following it. Without
// this, an open-redirect or 302→169.25.169.254 chain reaches internal/metadata
// services (P0-3 gap).
//
// Jina/Firecrawl extractors are NOT routed through this — they fetch the user
// URL on their own infra, so per-hop validation on the crystalith server would
// not apply. Only extractors that fetch the user URL directly on this process
// (readability, raw router fallback) should use this.
import { outboundFetch } from './outbound-fetch.ts';
import { validateUrlForFetch, type SsrfPolicy, SsrfBlockedError } from './url-safety.ts';

const DEFAULT_MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface FetchWithRedirectGuardOptions extends RequestInit {
  /** Override the policy's maxRedirects (otherwise policy.maxRedirects ?? 5). */
  maxRedirects?: number;
}

/**
 * Fetch a URL, manually following redirects and re-validating each hop against
 * the SSRF policy. Throws SsrfBlockedError if the initial URL or any redirect
 * target violates the policy; throws Error on too many redirects or a missing
 * Location header. Returns the final (non-redirect) Response.
 *
 * Network hops use outboundFetch so global proxy_settings apply (c109).
 */
export async function fetchWithRedirectGuard(
  url: string,
  policy: SsrfPolicy,
  init: FetchWithRedirectGuardOptions = {},
): Promise<Response> {
  const maxRedirects = init.maxRedirects ?? policy.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  // Validate the initial URL before any network call.
  await validateUrlForFetch(url, policy);

  let currentUrl = url;
  // Up to maxRedirects+1 hops: the +1 covers the final non-redirect response.
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await outboundFetch(currentUrl, { ...init, redirect: 'manual' });

    if (!REDIRECT_STATUSES.has(res.status)) return res;

    // 3xx: resolve the Location header (may be relative).
    const location = res.headers.get('location');
    if (!location) {
      throw new Error(`Redirect status ${res.status} without Location header`);
    }
    const nextUrl = new URL(location, currentUrl).href;

    // Re-validate every redirect target before following it.
    await validateUrlForFetch(nextUrl, policy);
    currentUrl = nextUrl;
  }
  throw new Error(`Too many redirects (>${maxRedirects})`);
}

export { SsrfBlockedError };
