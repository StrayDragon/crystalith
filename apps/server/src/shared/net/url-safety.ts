import { lookup as dnsLookup } from 'node:dns/promises';

// SSRF guard — validate a URL before fetching (mirrors v1 shared/net/url_safety.py:128-189).
//
// Key checks:
//   1. scheme must be http or https
//   2. reject userinfo (username:password@)
//   3. port must be 1-65535
//   4. IP-literal host: block cloud metadata (169.254.169.254), loopback, private, link-local
//   5. hostname: DNS resolve, check each returned IP
//   6. optional allowlist (hosts/domains/CIDRs/allowlist-only mode)
import ipaddr from 'ipaddr.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SsrfPolicy {
  /** Block all URLs except those matching the allowlist. */
  allowlistOnly?: boolean;
  /** Allowed hostnames (exact match). */
  hostAllowlist?: string[];
  /** Allowed domains (suffix match, e.g. "example.com" matches "sub.example.com"). */
  domainAllowlist?: string[];
  /** Allowed CIDR ranges. */
  cidrAllowlist?: string[];
}

export class SsrfBlockedError extends Error {
  constructor(
    message: string,
    public reason: string,
    public host?: string,
  ) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

const BLOCKED_IP4_ADDRS = new Set(['169.254.169.254', '0.0.0.0', '255.255.255.255']);

/** Check whether an IP address (v4 or v6) should be blocked. */
function isBlockedIp(ip: string): boolean {
  // Block well-known metadata endpoints and broadcast addresses.
  if (BLOCKED_IP4_ADDRS.has(ip)) return true;

  try {
    const parsed = ipaddr.parse(ip);
    const range = parsed.range();
    // Block loopback, private, link-local, carrier-grade NAT, unspecified.
    return (
      range === 'loopback' ||
      range === 'private' ||
      range === 'linkLocal' ||
      range === 'unspecified' ||
      range === 'carrierGradeNat'
    );
  } catch {
    // If we can't parse it, be safe and block it.
    return true;
  }
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

/**
 * Validate that a URL is safe to fetch (no SSRF, no metadata endpoint, etc.).
 * Throws SsrfBlockedError on failure; resolves void on success.
 */
export async function validateUrlForFetch(url: string, policy?: SsrfPolicy): Promise<void> {
  const parsed = new URL(url);

  // 1. scheme must be http / https.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError(`Blocked fetch of scheme "${parsed.protocol}"`, 'invalid_scheme');
  }

  // 2. reject userinfo (credentials embedded in URL).
  if (parsed.username || parsed.password) {
    throw new SsrfBlockedError('URL contains credentials (userinfo)', 'userinfo_rejected');
  }

  // 3. port must be in valid range.
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'http:' ? 80 : 443;
  if (port < 1 || port > 65535) {
    throw new SsrfBlockedError(`Invalid port: ${port}`, 'invalid_port');
  }

  // 4. IP-literal host: check directly.
  let host = parsed.hostname;
  if (ipaddr.isValid(host)) {
    if (isBlockedIp(host)) {
      throw new SsrfBlockedError(`Blocked IP: ${host}`, 'blocked_ip', host);
    }
    return; // IP direct, no DNS needed.
  }

  // 5. hostname: DNS resolve and check each IP.
  try {
    const records = await dnsLookup(host, { all: true, family: 4 });
    for (const r of records) {
      if (isBlockedIp(r.address)) {
        throw new SsrfBlockedError(
          `Blocked IP ${r.address} (resolved from ${host})`,
          'blocked_ip',
          r.address,
        );
      }
    }
  } catch (error) {
    if (error instanceof SsrfBlockedError) throw error;
    // DNS failure: if strict allowlist-only, allow; otherwise block.
    if (policy?.allowlistOnly) return;
    throw new SsrfBlockedError(
      `DNS resolution failed for ${host}: ${String(error)}`,
      'dns_error',
      host,
    );
  }
}
