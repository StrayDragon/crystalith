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

  // c133 r493：embedding.truncation_dims 的合法域 = 默认 embedding 模型声明的
  // mrlDims 成员（消费 embedding-runtime r474 的声明 SSOT）；非法值启动即拒。
  const embeddingSection = isRecord(parsed.embedding) ? parsed.embedding : {};
  const truncationDims = embeddingSection.truncation_dims;
  if (truncationDims !== undefined && truncationDims !== null) {
    const defaultId = models.defaults.embedding;
    const entry = models.available.find((m) => m.id === defaultId);
    const mrlDims = entry?.embedding?.mrlDims;
    if (!mrlDims || mrlDims.length === 0) {
      throw new Error(
        `embedding.truncation_dims=${truncationDims} 需要默认 embedding 模型（${defaultId ?? '未配置'}）声明 embedding.mrlDims`,
      );
    }
    // 先做类型守卫（S2）：非正整数值直接拒，避免成员校验信息里渲染 NaN。
    if (typeof truncationDims !== 'number' || !Number.isInteger(truncationDims)) {
      throw new Error(
        `embedding.truncation_dims 必须是正整数，收到 ${JSON.stringify(truncationDims)}`,
      );
    }
    if (!mrlDims.includes(truncationDims)) {
      throw new Error(
        `embedding.truncation_dims=${truncationDims} 不在模型 ${defaultId} 声明的 mrlDims [${mrlDims.join('/')}] 内`,
      );
    }
  }

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
  _explicitlySet = true;
  resetEnvOverlay();
}

/**
 * True once a test has resetConfig'd its own fixture. Integration setup uses
 * this to keep unseeded test files hermetic: without it they would inherit
 * the REAL app.yaml (e.g. its embedding dims) depending on runner CWD.
 */
let _explicitlySet = false;
export function configExplicitlySet(): boolean {
  return _explicitlySet;
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
