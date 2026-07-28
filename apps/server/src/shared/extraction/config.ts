// Resolve extractor keys from app config / env.
// Priority (highest first):
//   1. CL_JINA_API_KEY / CL_FIRECRAWL_API_KEY (process.env)
//   2. source_ingestion.web_extraction.{jina,firecrawl}.api_key
//      (yaml already prefers secret.CL_* → env.CL_* → deprecated JINA_*/FIRECRAWL_*)
//   3. Legacy extraction.{jina,firecrawl}_api_key

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function envKey(name: 'CL_JINA_API_KEY' | 'CL_FIRECRAWL_API_KEY'): string | undefined {
  return nonEmptyString(process.env[name]);
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
 * When `enabled` is explicitly false under web_extraction, treat as unavailable.
 * Missing section / missing flag → enabled (availability still needs API key).
 * CL_* keys still require enabled !== false (flip yaml `enabled` to use them).
 */
export function isWebExtractorEnabled(config: unknown, name: 'jina' | 'firecrawl'): boolean {
  const section = extractorSection(config, name);
  if (!section) return true;
  return section.enabled !== false;
}
