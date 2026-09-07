// Built-in plugin manifest — registration order matters: extractor plugins
// keep the v1/v2 fallback order (readability → jina → firecrawl).
import type { CrystalithPlugin } from '../types.ts';
import { extractorPlugins } from './extractors.ts';
import { slidesSlidevPlugin } from './slides-slidev.ts';

export const builtinPlugins: CrystalithPlugin[] = [...extractorPlugins, slidesSlidevPlugin];
