// Outbound HTTP SSOT for non-LLM facilities (c109).
// Search / URL fetch / web extractors MUST use outboundFetch so global
// proxy_settings can optionally inject Bun's fetch `proxy` option.
// AI SDK / LLM / embedding providers are intentionally NOT wired here.
import { getProxySettings, type ProxySettings } from '../config.ts';

export type OutboundFetchInit = RequestInit & {
  /** Bun extension — set by outboundFetch when proxy applies. */
  proxy?: string | { url: string; headers?: HeadersInit };
};

function nonEmpty(value: string | null | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

/** Whether hostname matches a no_proxy entry (exact, suffix, or leading-dot suffix). */
export function hostMatchesNoProxy(hostname: string, entry: string): boolean {
  const host = hostname.trim().toLowerCase();
  const rule = entry.trim().toLowerCase();
  if (!host || !rule) return false;
  if (rule === '*') return true;
  const normalized = rule.startsWith('.') ? rule.slice(1) : rule;
  if (!normalized) return false;
  return host === normalized || host.endsWith(`.${normalized}`);
}

export function isNoProxyHost(hostname: string, noProxy: readonly string[]): boolean {
  return noProxy.some((entry) => hostMatchesNoProxy(hostname, entry));
}

/**
 * Resolve Bun `proxy` URL for a target request URL, or undefined for direct.
 * - enabled=false → direct
 * - hostname in no_proxy → direct
 * - https target → https_url then http_url
 * - http target → http_url then https_url
 * - socks5_url ignored (c109 / C1)
 */
export function resolveOutboundProxy(
  targetUrl: string,
  settings: ProxySettings = getProxySettings(),
): string | undefined {
  if (!settings.enabled) return undefined;

  let hostname: string;
  let protocol: string;
  try {
    const u = new URL(targetUrl);
    hostname = u.hostname;
    protocol = u.protocol;
  } catch {
    return undefined;
  }

  if (isNoProxyHost(hostname, settings.no_proxy ?? [])) return undefined;

  const http = nonEmpty(settings.http_url);
  const https = nonEmpty(settings.https_url);
  if (protocol === 'https:') return https ?? http;
  if (protocol === 'http:') return http ?? https;
  return https ?? http;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * Non-LLM outbound fetch. When proxy_settings applies, passes Bun `proxy`.
 * Call sites MUST prefer this over global fetch for search/extract/url-fetch.
 */
export async function outboundFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const proxy = resolveOutboundProxy(requestUrl(input));
  if (!proxy) {
    return fetch(input, init);
  }
  const next: OutboundFetchInit = { ...init, proxy };
  return fetch(input, next as RequestInit);
}
