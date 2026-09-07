import type { ExtractorInfo } from '@crystalith/shared';

function isUrlPatternMatch(url: string, pattern: string): boolean {
  try {
    return new RegExp(pattern, 'iu').test(url);
  } catch {
    return false;
  }
}

/** Local urlPatterns match for URL import hints (fetch mode only; no network). */
export function matchExtractorsForUrl(
  url: string,
  extractors: readonly ExtractorInfo[],
): ExtractorInfo[] {
  const normalized = url.trim();
  if (!normalized) return [];

  const matched: ExtractorInfo[] = [];
  for (const extractor of extractors) {
    if (!extractor.enabled || !extractor.available) continue;
    const patterns = extractor.urlPatterns;
    if (!patterns || patterns.length === 0) continue;
    if (patterns.some((pattern) => isUrlPatternMatch(normalized, pattern))) {
      matched.push(extractor);
    }
  }

  return matched.toSorted((left, right) => left.priority - right.priority);
}

/** Highest-priority selected extractor type, or undefined when none selected. */
export function pickSelectedExtractor(
  matches: readonly ExtractorInfo[],
  selectedTypes: ReadonlySet<string>,
): string | undefined {
  if (selectedTypes.size === 0) return undefined;
  const picked = matches.find((entry) => selectedTypes.has(entry.type));
  return picked?.type;
}
