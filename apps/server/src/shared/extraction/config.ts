// Resolve extractor keys / hosts from app config / env.
// Priority (highest first):
//   keys:  CL_* → web_extraction.*.api_key → legacy extraction.*
//   base:  CL_FIRECRAWL_API_BASE → web_extraction.firecrawl.base_url → cloud default

export const DEFAULT_FIRECRAWL_API_BASE = 'https://api.firecrawl.dev';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function envKey(
  name: 'CL_JINA_API_KEY' | 'CL_FIRECRAWL_API_KEY' | 'CL_FIRECRAWL_API_BASE',
): string | undefined {
  return nonEmptyString(process.env[name]);
}

function normalizeApiBase(raw: string): string {
  return raw.replace(/\/+$/u, '');
}

function webExtractionBlock(config: unknown): Record<string, unknown> | undefined {
  if (!isRecord(config)) return undefined;
  const ingestion = config.source_ingestion;
  if (!isRecord(ingestion)) return undefined;
  const web = ingestion.web_extraction;
  return isRecord(web) ? web : undefined;
}

function extractorSection(
  config: unknown,
  name: 'jina' | 'firecrawl',
): Record<string, unknown> | undefined {
  const web = webExtractionBlock(config);
  if (!web) return undefined;
  const section = web[name];
  return isRecord(section) ? section : undefined;
}

/** Prefer CL_JINA_API_KEY, then web_extraction, then legacy extraction.* keys. */
export function resolveJinaApiKey(config: unknown): string | undefined {
  const fromCl = envKey('CL_JINA_API_KEY');
  if (fromCl) return fromCl;
  const fromWeb = nonEmptyString(extractorSection(config, 'jina')?.api_key);
  if (fromWeb) return fromWeb;
  if (!isRecord(config)) return undefined;
  const extraction = config.extraction;
  if (!isRecord(extraction)) return undefined;
  return nonEmptyString(extraction.jina_api_key);
}

/** Prefer CL_FIRECRAWL_API_KEY, then web_extraction, then legacy extraction.* keys. */
export function resolveFirecrawlApiKey(config: unknown): string | undefined {
  const fromCl = envKey('CL_FIRECRAWL_API_KEY');
  if (fromCl) return fromCl;
  const fromWeb = nonEmptyString(extractorSection(config, 'firecrawl')?.api_key);
  if (fromWeb) return fromWeb;
  if (!isRecord(config)) return undefined;
  const extraction = config.extraction;
  if (!isRecord(extraction)) return undefined;
  return nonEmptyString(extraction.firecrawl_api_key);
}

/**
 * Firecrawl API root (no trailing slash). Default cloud host when unset.
 * Priority: CL_FIRECRAWL_API_BASE → web_extraction.firecrawl.base_url → default.
 */
export function resolveFirecrawlApiBase(config: unknown): string {
  const fromCl = envKey('CL_FIRECRAWL_API_BASE');
  if (fromCl) return normalizeApiBase(fromCl);
  const fromWeb = nonEmptyString(extractorSection(config, 'firecrawl')?.base_url);
  if (fromWeb) return normalizeApiBase(fromWeb);
  return DEFAULT_FIRECRAWL_API_BASE;
}

/** POST target for scrape (self-hosted or cloud). */
export function resolveFirecrawlScrapeUrl(config: unknown): string {
  return `${resolveFirecrawlApiBase(config)}/v2/scrape`;
}

/**
 * When `enabled` is explicitly false under web_extraction, treat as unavailable.
 * Missing section / missing flag → enabled (availability still needs API key).
 */
export function isWebExtractorEnabled(config: unknown, name: 'jina' | 'firecrawl'): boolean {
  const section = extractorSection(config, name);
  if (!section) return true;
  return section.enabled !== false;
}
