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
  type ModelsSettings,
  type ModelConfig,
  type ModelDefaults,
  desc,
} from '@crystalith/shared';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import type { SsrfPolicy } from './net/url-safety.ts';

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
  if (_configPath === null) _configPath = getConfigPath();
  return _configPath;
}
export function secretPath(): string {
  if (_secretPath === null) _secretPath = getSecretPath();
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
  if (_secrets === null) _secrets = parseDotenv(secretPath());
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
  if (_envPath === null) _envPath = findDotenv();
  return _envPath;
}

function envOverlay(): Record<string, string> {
  if (_envOverlay === null) _envOverlay = parseDotenv(envPath());
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
  const parsed = parseYaml(rendered) as Record<string, unknown>;

  const models = ModelsSettingsSchema.parse(parsed.models ?? {});

  return { models, raw: parsed };
}

/** Process-wide singleton. */
export function config(): AppConfig {
  if (_config === null) _config = loadConfig();
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
      enabled: z.boolean().default(true),
    })
    .optional(),
});
export type SourceIngestionSettings = z.infer<typeof SourceIngestionSettingsSchema>;

/** Parse SSRF security policy from config YAML. */
export function getSecurityPolicy(): SsrfPolicy {
  const sec = (config().raw.source_ingestion as Record<string, unknown> | undefined)?.url_fetch as
    | Record<string, unknown>
    | undefined;
  const security = parseSection(SsrfPolicyConfigSchema, sec?.security);
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
    .max(120_000)
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

  const raw = (config().raw.storage ?? {}) as Record<string, unknown>;
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
  return schema.parse({} as unknown);
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

/** SearXNG host resolved from config → CL_SEARXNG_HOST → SEARXNG_HOST env fallback. Empty disables web search. */
export function getSearxngHost(): string {
  const host = getSearchSettings().searxng.host;
  return host || process.env.CL_SEARXNG_HOST || process.env.SEARXNG_HOST || '';
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
  chroma: OptionalServiceEntry;
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

/** Optional services schema — maps from `optional_services.*`. */
/** Optional services schema — maps from `optional_services.*`. */
export const OptionalServicesSchema = z.object({
  chroma: OptionalServiceEntrySchema.default({
    enabled: false,
    endpoint: 'http://localhost:8000',
    timeout_s: 3,
  } as z.infer<typeof OptionalServiceEntrySchema>),
  searxng: OptionalServiceEntrySchema.default({
    enabled: false,
    endpoint: 'http://127.0.0.1:50201',
    timeout_s: 10,
  } as z.infer<typeof OptionalServiceEntrySchema>),
  cache_redis: OptionalServiceEntrySchema.optional(),
});
export type OptionalServicesSettings = z.infer<typeof OptionalServicesSchema>;

/** Read optional_services config section. Returns defaults when absent. */
export function getOptionalServices(): OptionalServicesConfig {
  const parsed = parseSection(OptionalServicesSchema, config().raw.optional_services);
  return {
    chroma: {
      enabled: parsed.chroma.enabled,
      endpoint: parsed.chroma.endpoint ?? 'http://localhost:8000',
      timeout_s: parsed.chroma.timeout_s ?? 3,
    },
    searxng: {
      enabled: parsed.searxng.enabled,
      endpoint: parsed.searxng.endpoint ?? 'http://127.0.0.1:50201',
      timeout_s: parsed.searxng.timeout_s ?? 10,
    },
  };
}
