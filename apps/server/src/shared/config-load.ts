// Full config load: read app.yaml, render templates, validate `models`,
// and expose the process-wide singleton. `parseSection` is the shared
// "typed view over a raw yaml section" helper for the settings modules.
import { readFileSync, existsSync } from 'node:fs';

import { ModelsSettingsSchema, type ModelsSettings } from '@crystalith/shared';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import { configPath, resetEnvOverlay } from './config-env.ts';
import { renderTemplates } from './config-template.ts';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
  resetEnvOverlay();
}

/** Parse a config section safely — returns defaults on absence/invalid. */
export function parseSection<T>(schema: z.ZodType<T>, section: unknown): T {
  const result = schema.safeParse(section);
  if (result.success) return result.data;
  // When section is absent/undefined, parse an empty object so all nested
  // `.default()` values take effect.  Cast via unknown to satisfy TS since
  // `{}` may not structurally match the schema input type.
  return schema.parse({});
}
