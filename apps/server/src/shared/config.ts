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

import {
  ModelsSettingsSchema,
  type ModelsSettings,
  type ModelConfig,
  type ModelDefaults,
} from '@crystalith/shared';
import { parse as parseYaml } from 'yaml';

import type { SsrfPolicy } from './net/url-safety.ts';

export const CONFIG_PATH = process.env.CL_CONFIG_PATH ?? 'config/app.yaml';
export const SECRET_PATH = process.env.CL_SECRET_PATH ?? 'config/secret.env';

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
  if (_secrets === null) _secrets = parseDotenv(SECRET_PATH);
  return _secrets;
}

let _envOverlay: Record<string, string> | null = null;
function envOverlay(): Record<string, string> {
  if (_envOverlay === null) _envOverlay = parseDotenv('.env');
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
  return source.replaceAll(/\{\{([^}]+)\}\}/g, (_match, expr: string) => {
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
  const envMatch = head.match(/^env\.([A-Za-z_][A-Za-z0-9_]*)$/);
  if (envMatch) return envValue(envMatch[1]);

  const secretMatch = head.match(/^secret\.([A-Za-z_][A-Za-z0-9_]*)$/);
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
  const m = filter.match(/^([A-Za-z_]+)\((.*)\)$/);
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
export function loadConfig(path: string = CONFIG_PATH): AppConfig {
  if (!existsSync(path)) {
    return { models: { defaults: {}, available: [] }, raw: {} };
  }
  const raw = readFileSync(path, 'utf-8');
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
 * Parse SSRF security policy from config YAML.
 *
 * Path: `source_ingestion.url_fetch.security`
 * Returns an empty object when the section is absent (the default
 * deny-private-IP posture baked into validateUrlForFetch).
 */
export function getSecurityPolicy(): SsrfPolicy {
  const sec = (config().raw.source_ingestion as Record<string, unknown> | undefined)?.url_fetch as
    | Record<string, unknown>
    | undefined;
  const security = sec?.security as Record<string, unknown> | undefined;
  if (!security) return {};
  return {
    allowlistOnly: security.allowlist_only === true,
    hostAllowlist: Array.isArray(security.allowlist_hosts)
      ? (security.allowlist_hosts as string[])
      : undefined,
    domainAllowlist: Array.isArray(security.allowlist_domains)
      ? (security.allowlist_domains as string[])
      : undefined,
    cidrAllowlist: Array.isArray(security.allowlist_cidrs)
      ? (security.allowlist_cidrs as string[])
      : undefined,
  };
}

/**
 * Read `app.http_guardrails.upload_max_bytes` from config.
 * Falls back to 50 MB when absent or invalid.
 */
export function getUploadMaxBytes(): number {
  const guardrails = (config().raw.app as Record<string, unknown> | undefined)?.http_guardrails as
    | Record<string, unknown>
    | undefined;
  const n = guardrails?.upload_max_bytes;
  return typeof n === 'number' && n > 0 ? n : 50 * 1024 * 1024;
}
