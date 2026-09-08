// CrystalithPlugin — the single plugin interface SSOT (r7).
// Every plugin kind (output-type | extractor | parser | slides-workflow)
// registers through the same registry; per-kind behavioral contracts
// (web-extractor-plugins, slides-workflow-plugins specs) narrow the
// implementation shape but are not replaced by this interface.
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
  factory: (ctx: CrystalithPluginContext) => Promise<unknown>;
}

export interface PluginRegistration {
  plugin: CrystalithPlugin;
  source: 'builtin' | 'external';
}

export interface PluginSkip {
  errorCode: string;
  message: string;
  hint?: string;
}

export interface PluginLoadReport {
  loaded: string[];
  skipped: Record<string, PluginSkip>;
}
