// CrystalithPlugin — host plugin envelope SSOT (architecture-plugin-and-agent r7).
// Lives in @crystalith/shared so plugin packages depend only on shared, not
// apps/server (keeps the workspace acyclic for single-binary static imports).
// Per-kind implementation shapes (Extractor, Parser, …) stay in the server.
import type { z } from 'zod';

export type CrystalithPluginKind = 'output-type' | 'extractor' | 'parser' | 'slides-workflow';

export interface CrystalithPluginContext {
  /** Parsed per-plugin config (plugin.configSchema). Empty for built-ins today. */
  config: Record<string, unknown>;
  /** CL_DATA_ROOT-derived absolute path (configuration-governance). */
  dataRoot: string;
  /**
   * Host-provided network transport honoring the global proxy SSOT
   * (`proxy_settings` + CL_PROXY_* overlay). Plugins MUST use this for
   * outbound HTTP instead of global fetch so proxy/no-proxy semantics stay
   * in one place.
   */
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export interface CrystalithPlugin {
  /** Globally unique. Convention: `<kind-prefix>-<name>` (e.g. `extractor-jina`). */
  id: string;
  kind: CrystalithPluginKind;
  displayName: string;
  description?: string;
  /** Actionable hint shown when the plugin is unavailable (e.g. missing API key). */
  recoveryHint?: string;
  /** Declared config shape — derived into app.schema / future per-plugin config. */
  configSchema: z.ZodObject;
  /** Feature flags consumed by kind-level orchestration (e.g. 'requires-api-key'). */
  capabilities: readonly string[];
  /**
   * Optional URL regex sources for UI pre-selection hints (extractor plugins only).
   * MUST NOT affect server-side fall-through extraction semantics.
   */
  urlPatterns?: readonly string[];
  factory: (ctx: CrystalithPluginContext) => Promise<unknown>;
}
