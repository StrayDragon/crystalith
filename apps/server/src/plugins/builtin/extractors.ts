// Built-in extractor plugins (kind: 'extractor'). Wraps the three extractors
// previously registered by the factory's inline record — behavior unchanged,
// registration now goes through the plugin registry (r7).
// Wire extractor `name` keeps v1/v2 values ('readability' | 'jina' |
// 'firecrawl'): derived from the plugin id by stripping the `extractor-`
// prefix, so plugins.enabled/disabled keys stay stable (`extractor-*`).
import { z } from 'zod';

import { firecrawlExtractor } from '../../shared/extraction/firecrawl.ts';
import { jinaExtractor } from '../../shared/extraction/jina.ts';
import { readabilityExtractor } from '../../shared/extraction/readability.ts';
import type { Extractor } from '../../shared/extraction/types.ts';
import type { CrystalithPlugin } from '../types.ts';

const NO_CONFIG = z.object({}) as z.ZodObject;

interface ExtractorPluginOpts {
  id: string;
  displayName: string;
  description: string;
  recoveryHint?: string;
  extractor: Extractor;
  requiresApiKey?: boolean;
  requiresService?: boolean;
}

function extractorPlugin(opts: ExtractorPluginOpts): CrystalithPlugin {
  const capabilities = [
    ...(opts.requiresApiKey ? (['requires-api-key'] as const) : []),
    ...(opts.requiresService ? (['requires-service'] as const) : []),
  ];
  return {
    id: opts.id,
    kind: 'extractor',
    displayName: opts.displayName,
    description: opts.description,
    recoveryHint: opts.recoveryHint,
    configSchema: NO_CONFIG,
    capabilities,
    factory: async () => opts.extractor,
  };
}

/** Registration order == default fallback order (readability → jina → firecrawl). */
export const extractorPlugins: CrystalithPlugin[] = [
  extractorPlugin({
    id: 'extractor-readability',
    displayName: 'Readability (built-in)',
    description: '基于 @mozilla/readability 的本地正文提取，无需外部服务',
    extractor: readabilityExtractor,
  }),
  extractorPlugin({
    id: 'extractor-jina',
    displayName: 'Jina Reader',
    description: 'Jina Reader API，适合 JS 重渲染页面',
    recoveryHint: 'Set CL_JINA_API_KEY (shell / .env); falls back to JINA_API_KEY',
    extractor: jinaExtractor,
    requiresApiKey: true,
    requiresService: true,
  }),
  extractorPlugin({
    id: 'extractor-firecrawl',
    displayName: 'Firecrawl',
    description: 'Firecrawl API，浏览器渲染级提取',
    recoveryHint: 'Set CL_FIRECRAWL_API_KEY (+ optional CL_FIRECRAWL_API_BASE for self-hosted)',
    extractor: firecrawlExtractor,
    requiresApiKey: true,
    requiresService: true,
  }),
];
