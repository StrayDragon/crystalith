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
  /** Max HTTP redirects to follow when using fetchWithRedirectGuard (default 5). */
  maxRedirects?: number;
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
// Allowlist matching (mirrors v1 shared/net/url_safety.py:75-82)
// ---------------------------------------------------------------------------

/** True if hostname is allowed by the host/domain allowlist portion of a policy. */
function hostnameMatchesAllowlist(host: string, policy?: SsrfPolicy): boolean {
  if (!policy) return false;
  const h = host.toLowerCase();
  if (policy.hostAllowlist?.some((x) => x.toLowerCase() === h)) return true;
  // Domain suffix match: "example.com" matches "sub.example.com" (and itself).
  if (
    policy.domainAllowlist?.some((d) => {
      const dl = d.toLowerCase();
      return h === dl || h.endsWith('.' + dl);
    })
  )
    return true;
  return false;
}

/** True if an IP literal is allowed by the CIDR allowlist portion of a policy. */
function ipMatchesAllowlist(ip: string, policy?: SsrfPolicy): boolean {
  if (!policy?.cidrAllowlist?.length) return false;
  try {
    const addr = ipaddr.parse(ip);
    return policy.cidrAllowlist.some((cidr) => {
      try {
        return addr.match(ipaddr.parseCIDR(cidr));
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

/**
 * Validate that a URL is safe to fetch (no SSRF, no metadata endpoint, etc.).
 * Throws SsrfBlockedError on failure; resolves void on success.
 *
 * Policy (optional): when `allowlistOnly` is set, only hosts/IPs matching the
 * host/domain/CIDR allowlists are permitted; otherwise the allowlist is not
 * consulted and the default deny-private/metadata posture applies.
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

  const host = parsed.hostname;

  // 4. IP-literal host: check directly.
  if (ipaddr.isValid(host)) {
    if (isBlockedIp(host)) {
      throw new SsrfBlockedError(`Blocked IP: ${host}`, 'blocked_ip', host);
    }
    if (policy?.allowlistOnly && !ipMatchesAllowlist(host, policy)) {
      throw new SsrfBlockedError(`IP ${host} not in allowlist`, 'not_allowlisted', host);
    }
    return; // IP direct, no DNS needed.
  }

  // 5. hostname: DNS resolve and check each IP.
  let records: { address: string }[];
  try {
    records = await dnsLookup(host, { all: true, family: 4 });
  } catch (error) {
    // DNS failure: in allowlist-only mode a host that matches the host/domain
    // allowlist is permitted (its IPs are unknowable); otherwise block.
    if (policy?.allowlistOnly && hostnameMatchesAllowlist(host, policy)) return;
    throw new SsrfBlockedError(
      `DNS resolution failed for ${host}: ${String(error)}`,
      'dns_error',
      host,
    );
  }

  for (const r of records) {
    if (isBlockedIp(r.address)) {
      throw new SsrfBlockedError(
        `Blocked IP ${r.address} (resolved from ${host})`,
        'blocked_ip',
        r.address,
      );
    }
  }

  // 6. allowlist-only: the resolved host must match host/domain/CIDR allowlist.
  if (policy?.allowlistOnly) {
    const ok =
      hostnameMatchesAllowlist(host, policy) ||
      records.some((r) => ipMatchesAllowlist(r.address, policy));
    if (!ok) {
      throw new SsrfBlockedError(`Host ${host} not in allowlist`, 'not_allowlisted', host);
    }
  }
}
