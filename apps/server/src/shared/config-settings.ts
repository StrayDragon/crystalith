// Per-domain typed settings: models + app/security/ai/concurrency/embedding/
// context-window/search/completion/storage/proxy/plugins/optional-services.
// (Research lives in config-research.ts; the root schema composes everything.)
import {
  type ModelsSettings,
  type ModelConfig,
  type ModelDefaults,
  desc,
} from '@crystalith/shared';
import { z } from 'zod';

import { envValue } from './config-env.ts';
import { config, isRecord, parseSection } from './config-load.ts';
import type { SsrfPolicy } from './net/url-safety.ts';

// ---------------------------------------------------------------------------
// Models accessors
// ---------------------------------------------------------------------------

export function getModels(): ModelsSettings {
  return config().models;
}

export function getModelDefaults(): ModelDefaults {
  return config().models.defaults;
}

export function getModelById(id: string): ModelConfig | undefined {
  return config().models.available.find((m) => m.id === id);
}

export function getDefaultChatModel(): ModelConfig | undefined {
  const { models } = config();
  const id = models.defaults.chat;
  if (id) return models.available.find((m) => m.id === id);
  return models.available.find((m) => m.roles.includes('chat'));
}

export function getDefaultEmbeddingModel(): ModelConfig | undefined {
  const { models } = config();
  const id = models.defaults.embedding;
  if (id) return models.available.find((m) => m.id === id);
  return models.available.find((m) => m.roles.includes('embed'));
}

// ---------------------------------------------------------------------------
// Security + guardrail config (c25)
// ---------------------------------------------------------------------------

/**
 * SSRF security policy schema — maps from `source_ingestion.url_fetch.security.*`.
 */
export const SsrfPolicyConfigSchema = z.object({
  allowlist_only: z.boolean().default(false).describe(desc('ssrf.allowlist_only')),
  allowlist_hosts: z.array(z.string()).default([]).describe(desc('ssrf.allowlist_hosts')),
  allowlist_domains: z.array(z.string()).default([]).describe(desc('ssrf.allowlist_domains')),
  allowlist_cidrs: z.array(z.string()).default([]).describe(desc('ssrf.allowlist_cidrs')),
  max_redirects: z.number().int().min(0).max(20).default(5).describe(desc('ssrf.max_redirects')),
});
export type SsrfPolicyConfig = z.infer<typeof SsrfPolicyConfigSchema>;

/**
 * App-level settings schema — maps from `app.*`.
 */
export const AppSettingsSchema = z.object({
  features: z
    .object({
      workspace_frontend_bundles_enabled: z
        .boolean()
        .default(true)
        .describe(desc('app.features.workspace_frontend_bundles_enabled')),
    })
    .optional(),
  auth: z
    .object({
      enabled: z.boolean().default(false).describe(desc('app.auth.enabled')),
    })
    .optional(),
  cors: z
    .object({
      allow_origins: z
        .array(z.string())
        .default(['http://localhost:3000'])
        .describe(desc('app.cors.allow_origins')),
    })
    .optional(),
  startup: z
    .object({
      auto_db_init: z.boolean().default(true).describe(desc('app.startup.auto_db_init')),
      cleanup_failed_sources: z
        .boolean()
        .default(false)
        .describe(desc('app.startup.cleanup_failed_sources')),
    })
    .optional(),
  http_guardrails: z
    .object({
      upload_max_bytes: z
        .number()
        .int()
        .positive()
        .default(50 * 1024 * 1024)
        .describe(desc('app.http_guardrails.upload_max_bytes')),
    })
    .optional(),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

/**
 * Source ingestion settings schema — maps from `source_ingestion.*`.
 */
export const SourceIngestionSettingsSchema = z.object({
  dedup: z
    .object({
      enabled: z.boolean().default(true).optional(),
    })
    .optional(),
});
export type SourceIngestionSettings = z.infer<typeof SourceIngestionSettingsSchema>;

/** Parse SSRF security policy from config YAML. */
export function getSecurityPolicy(): SsrfPolicy {
  const sourceIngestion = config().raw.source_ingestion;
  const urlFetch = isRecord(sourceIngestion) ? sourceIngestion.url_fetch : undefined;
  const securitySection = isRecord(urlFetch) ? urlFetch.security : undefined;
  const security = parseSection(SsrfPolicyConfigSchema, securitySection);
  return {
    allowlistOnly: security.allowlist_only,
    hostAllowlist: security.allowlist_hosts.length > 0 ? security.allowlist_hosts : undefined,
    domainAllowlist: security.allowlist_domains.length > 0 ? security.allowlist_domains : undefined,
    cidrAllowlist: security.allowlist_cidrs.length > 0 ? security.allowlist_cidrs : undefined,
    maxRedirects: security.max_redirects,
  };
}

/** Read `app.http_guardrails.upload_max_bytes` from config. */
export function getUploadMaxBytes(): number {
  return (
    parseSection(AppSettingsSchema, config().raw.app).http_guardrails?.upload_max_bytes ??
    50 * 1024 * 1024
  );
}

/** c44: Dedup config gate — true by default. */
export function getDedupEnabled(): boolean {
  return (
    parseSection(SourceIngestionSettingsSchema, config().raw.source_ingestion).dedup?.enabled ??
    true
  );
}

// ---------------------------------------------------------------------------
// c40: AI / concurrency / embedding / search config (typed parsing)
//
// v1 parses ~20 config dimensions (config/models.py). v2 previously only
// parsed `models` + ad-hoc SSRF/upload reads. These schemas bring the most
// operationally important sections into typed access, aligned with v1
// defaults. Auth/rate-limit/CORS remain c13 (Server Mode) scope.
// ---------------------------------------------------------------------------

export const AiSettingsSchema = z.object({
  timeout: z.number().int().positive().max(600).default(60).describe(desc('ai.timeout')),
  max_retries: z.number().int().min(0).max(10).default(3).describe(desc('ai.max_retries')),
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;

export const ConcurrencySettingsSchema = z.object({
  embedding: z.number().int().min(0).default(8).describe(desc('concurrency.embedding')),
  vector_search: z.number().int().min(0).default(8).describe(desc('concurrency.vector_search')),
  llm_generate: z.number().int().min(0).default(4).describe(desc('concurrency.llm_generate')),
});
export type ConcurrencySettings = z.infer<typeof ConcurrencySettingsSchema>;

export const EmbeddingSettingsSchema = z.object({
  chunk_size: z.number().int().min(64).default(512).describe(desc('embedding.chunk_size')),
  batch_size: z.number().int().min(1).default(32).describe(desc('embedding.batch_size')),
});
export type EmbeddingSettings = z.infer<typeof EmbeddingSettingsSchema>;

export const ContextWindowSettingsSchema = z.object({
  max_tokens: z.number().int().positive().default(8000).describe(desc('context_window.max_tokens')),
  compression_strategy: z
    .enum(['truncate', 'summarize'])
    .default('truncate')
    .describe(desc('context_window.compression_strategy')),
  window_size: z.number().int().min(0).default(10).describe(desc('context_window.window_size')),
  priority: z
    .array(z.string())
    .default(['history', 'retrieval', 'recent', 'system'])
    .describe(desc('context_window.priority')),
});
export type ContextWindowSettings = z.infer<typeof ContextWindowSettingsSchema>;

export const SearXNGSettingsSchema = z.object({
  host: z.string().default('').describe(desc('search.searxng.host')),
  api_key: z.string().nullable().default(null).describe(desc('search.searxng.api_key')),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe(desc('search.searxng.max_results')),
  timeout: z
    .number()
    .int()
    .positive()
    .max(300_000)
    .default(20_000)
    .describe(desc('search.searxng.timeout')),
});
export type SearXNGSettings = z.infer<typeof SearXNGSettingsSchema>;

export const SearchSettingsSchema = z.object({
  searxng: SearXNGSettingsSchema.default(SearXNGSettingsSchema.parse({})),
});
export type SearchSettings = z.infer<typeof SearchSettingsSchema>;

export const CompletionOptionsSchema = z.object({
  temperature: z.number().min(0).max(2).optional().describe(desc('completion.temperature')),
  top_p: z.number().min(0).max(1).optional().describe(desc('completion.top_p')),
  top_k: z.number().int().min(0).optional().describe(desc('completion.top_k')),
  stop: z.array(z.string()).optional().describe(desc('completion.stop')),
  reasoning: z.number().int().min(0).optional().describe(desc('completion.reasoning')),
});
export type CompletionOptions = z.infer<typeof CompletionOptionsSchema>;

// ---------------------------------------------------------------------------
// Storage config — data root path for all runtime file storage
// ---------------------------------------------------------------------------

export const StorageSettingsSchema = z.object({
  data_root: z.string().default('./data').describe(desc('storage.data_root')),
});
export type StorageSettings = z.infer<typeof StorageSettingsSchema>;

/**
 * Resolve the data root directory path.
 * Priority:
 *   1. `CL_DATA_ROOT` env var (overrides everything)
 *   2. `storage.data_root` from config YAML (default: `./data`)
 *
 * Relative paths are resolved against `process.cwd()`. Use this as the base
 * for all runtime file storage: DB, slides, uploads, etc.
 */
export function getDataRoot(): string {
  const envPath = envValue('CL_DATA_ROOT');
  if (envPath) return envPath;

  const storageRaw = config().raw.storage;
  const raw = isRecord(storageRaw) ? storageRaw : {};
  const result = StorageSettingsSchema.safeParse(raw);
  return result.success ? result.data.data_root : './data';
}

export function getAiSettings(): AiSettings {
  return parseSection(AiSettingsSchema, config().raw.ai);
}

export function getConcurrencySettings(): ConcurrencySettings {
  return parseSection(ConcurrencySettingsSchema, config().raw.concurrency);
}

export function getEmbeddingSettings(): EmbeddingSettings {
  return parseSection(EmbeddingSettingsSchema, config().raw.embedding);
}

export function getContextWindowSettings(): ContextWindowSettings {
  return parseSection(ContextWindowSettingsSchema, config().raw.context_window);
}

/**
 * Search settings from `search.searxng.*`.
 *
 * NOTE: v1 uses `search.searxng.host`; an earlier v2 revision read from the
 * wrong key (`search_engine.searxng_host`). This accessor reads the correct
 * v1 path. Falls back to SEARXNG_HOST env var when config host is empty.
 */
export function getSearchSettings(): SearchSettings {
  return parseSection(SearchSettingsSchema, config().raw.search);
}

/** SearXNG host from `search.searxng.host` (yaml ← CL_SEARXNG_HOST) → env fallbacks. Empty disables web search. */
export function getSearxngHost(): string {
  const host = getSearchSettings().searxng.host;
  // intentionally || — empty string is missing
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing
  return host || process.env.CL_SEARXNG_HOST || process.env.SEARXNG_HOST || '';
}

/** Global outbound proxy (`proxy_settings`). socks5_url is ignored by outboundFetch (c109). */
export function getProxySettings(): ProxySettings {
  return overlayProxyEnv(parseSection(ProxySettingsSchema, config().raw.proxy_settings));
}

/** Plugin discovery settings (`plugins` section), normalized to arrays. */
export function getPluginsSettings(): {
  enabled: string[];
  disabled: string[];
  load_order: string[];
} {
  const raw = parseSection(PluginsSettingsSchema, config().raw.plugins);
  return {
    enabled: raw.enabled ?? [],
    disabled: raw.disabled ?? [],
    load_order: raw.load_order ?? [],
  };
}

/**
 * CL_PROXY_* env overlay on the yaml `proxy_settings` section (precedent:
 * getSearxngHost). `CL_PROXY_ENABLED` accepts 'true'/'false'; unset, empty,
 * or any other value keeps the yaml setting. URLs override only when
 * non-empty, so app.yaml stays the single place describing default topology.
 */
function overlayProxyEnv(settings: ProxySettings): ProxySettings {
  const enabledEnv = process.env.CL_PROXY_ENABLED?.trim().toLowerCase();
  const enabled = enabledEnv === 'true' ? true : enabledEnv === 'false' ? false : settings.enabled;
  const httpEnv = process.env.CL_PROXY_HTTP_URL?.trim();
  const httpsEnv = process.env.CL_PROXY_HTTPS_URL?.trim();
  return {
    ...settings,
    enabled,
    http_url: httpEnv ? httpEnv : settings.http_url,
    https_url: httpsEnv ? httpsEnv : settings.https_url,
  };
}

/** Completion options from `completion_options` config section (optional fields). */
export function getCompletionOptions(): CompletionOptions {
  return parseSection(CompletionOptionsSchema, config().raw.completion_options);
}

// ---------------------------------------------------------------------------
// Optional services config (used by /health/dependencies)
// ---------------------------------------------------------------------------

export interface OptionalServiceEntry {
  enabled: boolean;
  endpoint?: string;
  timeout_s?: number;
}

export interface OptionalServicesConfig {
  cache_redis?: OptionalServiceEntry;
  searxng: OptionalServiceEntry;
}

/** Optional service entry schema. */
const OptionalServiceEntrySchema = z.object({
  enabled: z
    .boolean()
    .default(false)
    .describe(desc('optional_services.generic.enabled', '是否启用该服务')),
  endpoint: z
    .string()
    .optional()
    .describe(desc('optional_services.generic.endpoint', '服务端点地址')),
  timeout_s: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(desc('optional_services.generic.timeout_s', '请求超时（秒）')),
});

/**
 * Optional services yaml shape (legacy). SearXNG fields here are ignored at
 * runtime — see `getOptionalServices()` which derives from `search.searxng`.
 */
export const OptionalServicesSchema = z.object({
  searxng: OptionalServiceEntrySchema.optional(),
  cache_redis: OptionalServiceEntrySchema.optional(),
});
export type OptionalServicesSettings = z.infer<typeof OptionalServicesSchema>;

/**
 * Optional services for `/health/dependencies`.
 *
 * SearXNG is **not** configured here: host / enablement / probe timeout are
 * derived from `search.searxng.*` via `getSearxngHost()` (same SSOT as
 * `searchWeb`). Empty host → disabled in diagnostics and web search.
 */
export function getOptionalServices(): OptionalServicesConfig {
  // Still parse yaml so unknown keys / redis stubs stay valid against RootConfig.
  parseSection(OptionalServicesSchema, config().raw.optional_services);
  const host = getSearxngHost();
  const timeoutMs = getSearchSettings().searxng.timeout ?? 10_000;
  // Health probe must stay short; searchWeb uses the full search.searxng.timeout.
  const probeTimeoutS = Math.min(10, Math.max(1, Math.ceil(timeoutMs / 1000)));
  return {
    searxng: {
      enabled: Boolean(host),
      endpoint: host || undefined,
      timeout_s: probeTimeoutS,
    },
  };
}

// ===========================================================================
// Section schemas for YAML sections not yet migrated to typed accessors.
// These exist in config/app.yaml but are read ad-hoc (v1 legacy or pending
// typed accessor migration). Defined here so RootConfigSchema covers all
// YAML sections → app.schema.gen.json validates the entire file.
// ===========================================================================

/** Cache settings — read by v1 Python backend; v2 defaults to memory. */
export const CacheSettingsSchema = z.object({
  provider: z
    .enum(['memory', 'auto'])
    .default('memory')
    .describe(desc('cache.provider', '缓存提供者：memory 内存 / auto 自动选择')),
  ttl: z.number().int().positive().default(60).describe(desc('cache.ttl', '缓存 TTL（秒）')),
  max_size: z
    .number()
    .int()
    .positive()
    .default(2048)
    .describe(desc('cache.max_size', '缓存最大条目数')),
});
export type CacheSettings = z.infer<typeof CacheSettingsSchema>;

/**
 * Slides preview (Slidev) probe — SSOT for SLIDES availability diagnostics
 * (probe-slides-availability). A literal empty string in app.yaml explicitly
 * disables the probe (SLIDES reports unavailable); leaving
 * CL_SLIDEV_BASE_URL unset falls back to the yaml default.
 */
export const SlidesPreviewSchema = z.object({
  base_url: z
    .string()
    .default('http://127.0.0.1:3030')
    .describe(
      desc(
        'slides_preview.base_url',
        'Slidev 预览进程基地址；在 app.yaml 中字面量置空可显式禁用探测（CL_SLIDEV_BASE_URL 留空 = 使用默认值）',
      ),
    ),
  probe_timeout_ms: z
    .number()
    .int()
    .positive()
    .default(1500)
    .describe(desc('slides_preview.probe_timeout_ms', '预览可达性探测超时（毫秒）')),
});
export type SlidesPreviewConfig = z.infer<typeof SlidesPreviewSchema>;

/** Typed accessor for the `slides_preview` section (r158). */
export function getSlidesPreview(): SlidesPreviewConfig {
  return parseSection(SlidesPreviewSchema, config().raw.slides_preview);
}

/** Database settings — v1 SQLAlchemy URL; v2 uses bun:sqlite. */
export const DatabaseSettingsSchema = z.object({
  url: z
    .string()
    .default('sqlite+aiosqlite:///./data/app.db')
    .describe(desc('database.url', '数据库连接 URL（v1 兼容）')),
  url_candidates: z
    .array(z.string())
    .default([])
    .describe(desc('database.url_candidates', '备用数据库 URL 列表')),
});
export type DatabaseSettings = z.infer<typeof DatabaseSettingsSchema>;

/** Plugin discovery configuration. */
export const PluginsSettingsSchema = z.object({
  enabled: z
    .array(z.string())
    .nullable()
    .optional()
    .describe(desc('plugins.enabled', '启用的插件 ID 列表（白名单）')),
  disabled: z
    .array(z.string())
    .default([])
    .describe(desc('plugins.disabled', '禁用的插件 ID 列表（黑名单，优先）')),
  load_order: z
    .array(z.string())
    .default([])
    .describe(desc('plugins.load_order', '插件加载顺序（后加载优先）')),
});
export type PluginsSettings = z.infer<typeof PluginsSettingsSchema>;

/** Outbound proxy settings — used by URL fetchers. */
export const ProxySettingsSchema = z.object({
  enabled: z
    .boolean()
    .default(false)
    .optional()
    .describe(desc('proxy_settings.enabled', '是否启用代理')),
  http_url: z
    .string()
    .nullable()
    .default(null)
    .describe(desc('proxy_settings.http_url', 'HTTP 代理 URL')),
  https_url: z
    .string()
    .nullable()
    .default(null)
    .describe(desc('proxy_settings.https_url', 'HTTPS 代理 URL')),
  socks5_url: z
    .string()
    .nullable()
    .default(null)
    .describe(desc('proxy_settings.socks5_url', 'SOCKS5 代理 URL')),
  no_proxy: z
    .array(z.string())
    .default(['localhost', '127.0.0.1'])
    .describe(desc('proxy_settings.no_proxy', '不走代理的地址列表')),
});
export type ProxySettings = z.infer<typeof ProxySettingsSchema>;
