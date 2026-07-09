// URL normalization — strip tracking noise for dedup-friendly canonical URLs.
// Mirrors v1 shared/net/url_normalize.py:20-57.

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'yclid',
  'igshid',
  'ref',
  'ref_src',
]);

/**
 * Return a canonical version of `url` suitable for dedup-key calculation.
 * Steps:
 *   1. lowercase hostname
 *   2. strip fragment
 *   3. strip default ports (80 for http, 443 for https)
 *   4. remove known tracking query params
 *   5. sort remaining query params alphabetically
 *   6. strip trailing slash on non-root path
 */
export function canonicalizeUrlForDedup(url: string): string {
  const u = new URL(url);
  u.hostname = u.hostname.toLowerCase();
  u.hash = ''; // strip fragment

  // Strip default ports.
  if (
    (u.protocol === 'http:' && u.port === '80') ||
    (u.protocol === 'https:' && u.port === '443')
  ) {
    u.port = '';
  }

  // Remove tracking params.
  const params = new URLSearchParams(u.search);
  for (const key of TRACKING_PARAMS) {
    params.delete(key);
  }
  params.sort();
  u.search = params.toString();

  // Strip trailing slash on non-root path.
  if (u.pathname.length > 1) {
    u.pathname = u.pathname.replace(/\/+$/, '');
  }

  return u.toString();
}
