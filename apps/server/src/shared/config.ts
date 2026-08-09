// Configuration loader — reads config/app.yaml, renders `{{ env.* }}` /
// `{{ secret.* }}` template expressions, and validates against the shared
// Zod schemas. The result is a typed `AppConfig` consumed by the AI runtime
// (provider registry) and the models management endpoint.
//
// Template syntax (simplified Jinja2 subset, matching v1 app.yaml):
//   {{ env.KEY }}                              — process.env + .env overlay
//   {{ secret.KEY }}                           — config/secret.env
//   {{ env.KEY | default('fallback') }}        — with default
//   {{ secret.KEY | default(env.KEY | default('')) }}  — chained defaults
//
// YAML anchors (&name / <<: *name) are handled natively by the `yaml` parser.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

import {
  ModelsSettingsSchema,
  ProviderConfigSchema,
  type ModelsSettings,
  type ModelConfig,
  type ModelDefaults,
  desc,
} from '@crystalith/shared';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import type { SsrfPolicy } from './net/url-safety.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getConfigPath(): string {
  return envValue('CL_CONFIG_PATH') ?? 'config/app.yaml';
}
export function getSecretPath(): string {
  return envValue('CL_SECRET_PATH') ?? 'config/secret.env';
}

// Lazy init — resolve paths after env overlay is ready.
let _configPath: string | null = null;
let _secretPath: string | null = null;
export function configPath(): string {
  _configPath ??= getConfigPath();
  return _configPath;
}
export function secretPath(): string {
  _secretPath ??= getSecretPath();
  return _secretPath;
}

// ---------------------------------------------------------------------------
// Secret + env loading
// ---------------------------------------------------------------------------

/** Parse a dotenv file into a record (does not mutate process.env). */
function parseDotenv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, 'utf-8');
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes.
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

let _secrets: Record<string, string> | null = null;
function secrets(): Record<string, string> {
  _secrets ??= parseDotenv(secretPath());
  return _secrets;
}

let _envOverlay: Record<string, string> | null = null;
/** Look up .env — try CWD first, then walk up to repo root. */
function findDotenv(): string {
  const cwd = process.cwd();
  // Fast path: .env at CWD
  if (existsSync('.env')) return '.env';
  // Walk up from CWD to find repo root (has .git or package.json at top)
  let dir = cwd;
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // fallback
  return '.env';
}

let _envPath: string | null = null;
function envPath(): string {
  _envPath ??= findDotenv();
  return _envPath;
}

function envOverlay(): Record<string, string> {
  _envOverlay ??= parseDotenv(envPath());
  return _envOverlay;
}

function envValue(key: string): string | undefined {
  return process.env[key] ?? envOverlay()[key];
}

// ---------------------------------------------------------------------------
// Template renderer — `{{ env.KEY | default('x') }}`
// ---------------------------------------------------------------------------

/** Render all `{{ ... }}` expressions in a string. */
function renderTemplates(source: string): string {
  return source.replaceAll(/\{\{([^}]+)\}\}/gu, (_match, expr: string) => {
    return String(resolveExpression(expr.trim()));
  });
}

/**
 * Resolve a single template expression like
 * `env.KEY | default(secret.X | default('fallback'))`.
 */
function resolveExpression(expr: string): unknown {
  const pipeParts = splitTopLevel(expr, '|').map((s) => s.trim());
  const head = pipeParts[0];
  const filters = pipeParts.slice(1);

  let value: unknown = resolveLookup(head);

  for (const filter of filters) {
    value = applyFilter(value, filter);
  }
  return value;
}

/** Split on `|` but not inside parentheses or quotes. */
function splitTopLevel(s: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuote: string | null = null;
  let current = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuote) {
      current += ch;
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

/** Resolve `env.KEY` or `secret.KEY` or a bare string literal. */
function resolveLookup(head: string): unknown {
  const envMatch = head.match(/^env\.([A-Za-z_][A-Za-z0-9_]*)$/u);
  if (envMatch) return envValue(envMatch[1]);

  const secretMatch = head.match(/^secret\.([A-Za-z_][A-Za-z0-9_]*)$/u);
  if (secretMatch) return secrets()[secretMatch[1]];

  // Bare quoted string literal.
  if (
    (head.startsWith("'") && head.endsWith("'")) ||
    (head.startsWith('"') && head.endsWith('"'))
  ) {
    return head.slice(1, -1);
  }
  return head;
}

/** Apply a single `filter(...)` expression. */
function applyFilter(value: unknown, filter: string): unknown {
  const m = filter.match(/^([A-Za-z_]+)\((.*)\)$/u);
  if (!m) return value;
  const [, name, argStr] = m;
  if (name === 'default') {
    if (value === undefined || value === null || value === '') {
      // The arg can itself be a nested expression.
      return resolveExpression(argStr.trim());
    }
    return value;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Full config load
// ---------------------------------------------------------------------------

export interface AppConfig {
  models: ModelsSettings;
  /** Raw parsed YAML (untyped sections) for feature-specific access. */
  raw: Record<string, unknown>;
}

let _config: AppConfig | null = null;

/** Load + render + validate the config. Throws on invalid models section. */
export function loadConfig(path?: string): AppConfig {
  const resolvedPath = path ?? configPath();
  if (!existsSync(resolvedPath)) {
    return { models: { defaults: {}, available: [] }, raw: {} };
  }
  const raw = readFileSync(resolvedPath, 'utf-8');
  const rendered = renderTemplates(raw);
  const parsedYaml: unknown = parseYaml(rendered);
  const parsed = isRecord(parsedYaml) ? parsedYaml : {};

  const models = ModelsSettingsSchema.parse(parsed.models ?? {});

  return { models, raw: parsed };
}

/** Process-wide singleton. */
export function config(): AppConfig {
  _config ??= loadConfig();
  return _config;
}

/** Force a reload (tests / config hot-reload). */
export function resetConfig(cfg: AppConfig | null = null): void {
  _config = cfg;
  _secrets = null;
  _envOverlay = null;
}

// ---------------------------------------------------------------------------
// Convenience accessors
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

const RESEARCH_SETTINGS_FALLBACK: ResearchSettings = {
  progressEventRetain: 200,
  parallelBranchUnits: 2,
  pageRatio: 1.5,
  workUnitMaxSteps: 12,
  nodeContentTokenBudget: 32768,
  nodeSummaryTokenBudget: 65536,
  addOnRatio: 0.25,
  addOnMinK: 5,
  addOnMaxK: 50,
};

/** Parsed `research:` section from app.yaml (defaults applied). */
export function getResearchSettings(): ResearchSettings {
  const parsed = ResearchSettingsSchema.safeParse(config().raw.research ?? {});
  return parsed.success ? parsed.data : { ...RESEARCH_SETTINGS_FALLBACK };
}

/** maxPageFetches = ceil(maxSearches * pageRatio); default ratio 1.5. */
export function getPageRatio(): number {
  const n = getResearchSettings().pageRatio ?? 1.5;
  if (!Number.isFinite(n) || n <= 0) return 1.5;
  return n;
}

/** ToolLoopAgent work_unit step cap (c107). */
export function getWorkUnitMaxSteps(): number {
  const n = getResearchSettings().workUnitMaxSteps ?? 12;
  if (!Number.isFinite(n)) return 12;
  return Math.max(1, Math.trunc(n));
}

/** Per-node web evidence content token budget (c107). */
export function getNodeContentTokenBudget(): number {
  const n = getResearchSettings().nodeContentTokenBudget ?? 32768;
  if (!Number.isFinite(n)) return 32768;
  return Math.max(1, Math.trunc(n));
}

/** Node short-synthesis evidence context token budget (c107). */
export function getNodeSummaryTokenBudget(): number {
  const n = getResearchSettings().nodeSummaryTokenBudget ?? 65536;
  if (!Number.isFinite(n)) return 65536;
  return Math.max(1, Math.trunc(n));
}

/**
 * Concurrent research-node work-units per Run (c106).
 * Always clamped to 1..8 even if callers bypass Zod.
 */
export function getParallelBranchUnits(): number {
  const n = getResearchSettings().parallelBranchUnits ?? 2;
  if (!Number.isFinite(n)) return 2;
  return Math.min(8, Math.max(1, Math.trunc(n)));
}

/**
 * Model for topic auto-decompose planner.
 * Uses `research.decomposeModelId` when set; otherwise inherits default chat.
 */
export function getResearchDecomposeModelConfig(): ModelConfig | undefined {
  const id = getResearchSettings().decomposeModelId?.trim();
  if (id) return getModelById(id) ?? getDefaultChatModel();
  return getDefaultChatModel();
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

/** Parse a config section safely — returns defaults on absence/invalid. */
function parseSection<T>(schema: z.ZodType<T>, section: unknown): T {
  const result = schema.safeParse(section);
  if (result.success) return result.data;
  // When section is absent/undefined, parse an empty object so all nested
  // `.default()` values take effect.  Cast via unknown to satisfy TS since
  // `{}` may not structurally match the schema input type.
  return schema.parse({});
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
  return parseSection(ProxySettingsSchema, config().raw.proxy_settings);
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

// ===========================================================================
// Root config schema — single combined schema for app.yaml generation
// (gen-app-schema.ts consumes this instead of a manual section mapping).
// Each section carries an inline .describe() for JSON Schema doc.
// ===========================================================================

export const ResearchSettingsSchema = z.object({
  progressEventRetain: z
    .number()
    .int()
    .positive()
    .default(200)
    .describe(desc('research.progress_event_retain', '终态后进度账本保留最近 N 条')),
  /**
   * Max concurrent research-node work-units per Run (c106).
   * 1 = serial (behavioral parity with pre-c106 drain); default 2; clamp 1..8.
   */
  parallelBranchUnits: z
    .number()
    .int()
    .min(1)
    .max(8)
    .default(2)
    .describe(
      desc(
        'research.parallel_branch_units',
        '同一 Run 同时推进的支路 work-unit 上限（1=串行，默认 2，最大 8）',
      ),
    ),
  /** Optional model id for topic decompose planner; omit/empty inherits models.defaults.chat. */
  decomposeModelId: z
    .string()
    .optional()
    .describe(
      desc(
        'research.decompose_model_id',
        '主题自动拆解所用模型 id；省略或空字符串时继承 models.defaults.chat',
      ),
    ),
  /** maxPageFetches = ceil(maxSearches * pageRatio); default 1.5 (c107). */
  pageRatio: z
    .number()
    .positive()
    .default(1.5)
    .describe(desc('research.page_ratio', '读页预算 = ceil(maxSearches × pageRatio)')),
  /** ToolLoopAgent work_unit step cap (c107). */
  workUnitMaxSteps: z
    .number()
    .int()
    .positive()
    .default(12)
    .describe(desc('research.work_unit_max_steps', '节点 work_unit 工具环最大步数')),
  /** Per-node web evidence content token budget (c107). */
  nodeContentTokenBudget: z
    .number()
    .int()
    .positive()
    .default(32768)
    .describe(desc('research.node_content_token_budget', '单节点网页正文合计 token 上限')),
  /** Node short-synthesis evidence context token budget (c107). */
  nodeSummaryTokenBudget: z
    .number()
    .int()
    .positive()
    .default(65536)
    .describe(desc('research.node_summary_token_budget', '节点短综合证据上下文 token 上限')),
  /** Search budget add-on: K = clamp(ceil(maxSearches × ratio), minK, maxK) (c108). */
  addOnRatio: z
    .number()
    .positive()
    .default(0.25)
    .describe(desc('research.add_on_ratio', '检索加购比例：K=ceil(maxSearches×ratio)')),
  addOnMinK: z
    .number()
    .int()
    .positive()
    .default(5)
    .describe(desc('research.add_on_min_k', '检索加购块下限')),
  addOnMaxK: z
    .number()
    .int()
    .positive()
    .default(50)
    .describe(desc('research.add_on_max_k', '检索加购块上限')),
});
export type ResearchSettings = z.infer<typeof ResearchSettingsSchema>;

/** Search add-on knobs from config (c108). */
export function getSearchAddOnSettings(): {
  addOnRatio: number;
  addOnMinK: number;
  addOnMaxK: number;
} {
  const s = getResearchSettings();
  return {
    addOnRatio: s.addOnRatio ?? 0.25,
    addOnMinK: s.addOnMinK ?? 5,
    addOnMaxK: s.addOnMaxK ?? 50,
  };
}

export const RootConfigSchema = z.object({
  app: AppSettingsSchema.describe(
    desc('root.app', '应用层设置：CORS、auth、startup behavior、feature flags'),
  ),
  ai: AiSettingsSchema.describe(desc('root.ai', 'AI 运行时设置：超时、重试次数')),
  completion_options: CompletionOptionsSchema.describe(
    desc('root.completion_options', 'Completion 参数默认值：temperature、top_p、stop 序列等'),
  ),
  concurrency: ConcurrencySettingsSchema.describe(
    desc('root.concurrency', '并发控制门禁：embedding、vector_search、llm_generate 的并发数限制'),
  ),
  embedding: EmbeddingSettingsSchema.describe(
    desc('root.embedding', '文本嵌入设置：chunk_size、batch_size'),
  ),
  context_window: ContextWindowSettingsSchema.describe(
    desc('root.context_window', '上下文窗口设置：max_tokens、compression_strategy、window_size'),
  ),
  search: SearchSettingsSchema.describe(
    desc('root.search', '搜索引擎设置：SearXNG 实例地址、超时、最大结果数'),
  ),
  optional_services: OptionalServicesSchema.describe(
    desc(
      'root.optional_services',
      '可选服务段落（Redis 等）。SearXNG 诊断与网搜统一走 search.searxng.host / CL_SEARXNG_HOST，本段 searxng 字段已忽略。',
    ),
  ),
  storage: StorageSettingsSchema.describe(desc('root.storage', '存储设置：数据根目录路径')),
  source_ingestion: z
    .object({
      url_fetch: z
        .object({
          proxy: z.object({
            enabled: z.boolean().default(false).optional(),
            http_url: z.string().default('').nullable().optional(),
            https_url: z.string().default('').nullable().optional(),
            socks5_url: z.string().default('').nullable().optional(),
            no_proxy: z.array(z.string()).default(['localhost', '127.0.0.1']).optional(),
          }),
          timeout: z
            .number()
            .int()
            .positive()
            .default(30)
            .optional()
            .describe(desc('source_ingestion.url_fetch.timeout')),
          retry_count: z
            .number()
            .int()
            .min(0)
            .default(2)
            .optional()
            .describe(desc('source_ingestion.url_fetch.retry_count')),
          retry_delay: z
            .number()
            .positive()
            .default(1.0)
            .optional()
            .describe(desc('source_ingestion.url_fetch.retry_delay')),
          security: SsrfPolicyConfigSchema.partial()
            .default({})
            .optional()
            .describe(desc('source_ingestion.url_fetch.security')),
        })
        .optional()
        .describe(desc('source_ingestion.url_fetch')),
      web_extraction: z
        .object({
          fallback_order: z
            .array(z.string())
            .default(['trafilatura', 'jina', 'firecrawl', 'browserless'])
            .optional(),
          enable_fallback: z.boolean().default(true).optional(),
          trafilatura: z.object({
            enabled: z.boolean().default(true).optional(),
            include_tables: z.boolean().default(true).optional(),
            include_links: z.boolean().default(true).optional(),
            output_format: z.string().default('markdown').optional(),
            timeout: z.number().int().positive().default(30).optional(),
            proxy: z.object({
              enabled: z.boolean().default(false).optional(),
              http_url: z.string().default('').nullable().optional(),
              https_url: z.string().default('').nullable().optional(),
              socks5_url: z.string().default('').nullable().optional(),
              no_proxy: z.array(z.string()).default(['localhost', '127.0.0.1']).optional(),
            }),
          }),
          jina: z.object({
            enabled: z.boolean().default(true).optional(),
            api_key: z.string().default('').optional(),
            timeout: z.number().int().positive().default(30).optional(),
            proxy: z.object({
              enabled: z.boolean().default(false).optional(),
              http_url: z.string().default('').nullable().optional(),
              https_url: z.string().default('').nullable().optional(),
              socks5_url: z.string().default('').nullable().optional(),
              no_proxy: z.array(z.string()).default(['localhost', '127.0.0.1']).optional(),
            }),
          }),
          firecrawl: z.object({
            enabled: z.boolean().default(false).optional(),
            api_key: z.string().default('').optional(),
            base_url: z.string().default('').optional(),
            timeout: z.number().int().positive().default(60).optional(),
          }),
          browserless: z.object({
            enabled: z.boolean().default(false).optional(),
            endpoint: z.string().default('ws://localhost:3000').optional(),
            token: z.string().default('').optional(),
          }),
        })
        .optional()
        .describe(desc('source_ingestion.web_extraction')),
    })
    .describe(desc('root.source_ingestion')),
  models: ModelsSettingsSchema.describe(
    desc('root.models', '模型配置：默认模型、可用模型列表、提供商配置'),
  ),
  providers: z
    .record(z.string(), ProviderConfigSchema.catchall(z.unknown()))
    .default({})
    .describe(desc('root.providers', 'AI 提供商配置：name → API key、base URL')),
  cache: CacheSettingsSchema.describe(desc('root.cache', '缓存设置：provider、TTL、最大条目数')),
  database: DatabaseSettingsSchema.describe(desc('root.database', '数据库设置（v1 兼容）')),
  plugins: PluginsSettingsSchema.describe(desc('root.plugins', '插件发现与加载配置')),
  proxy_settings: ProxySettingsSchema.describe(desc('root.proxy_settings', '出站代理设置')),
  research: ResearchSettingsSchema.default({
    progressEventRetain: 200,
    parallelBranchUnits: 2,
    pageRatio: 1.5,
    workUnitMaxSteps: 12,
    nodeContentTokenBudget: 32768,
    nodeSummaryTokenBudget: 65536,
    addOnRatio: 0.25,
    addOnMinK: 5,
    addOnMaxK: 50,
  }).describe(
    desc(
      'root.research',
      'Deep Research 运行时：进度账本保留、支路并行度、读页预算比、加购公式、work_unit 步数、token 预算、可选拆解模型等',
    ),
  ),
});
export type RootConfig = z.infer<typeof RootConfigSchema>;
