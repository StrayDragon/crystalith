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
// fallow-ignore-next-line complexity -- loadConfig 是历史累积的校验管线（c125 存储
// 守卫 + c133 截断域校验）；本 change 仅新增截断校验调用，整体拆分超范围。
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
  const truncationDims = readTruncationDims(embeddingSection);
  if (truncationDims !== null) assertTruncationDomain(truncationDims, models);

  return { models, raw: parsed };
}

/** 值缺省（undefined/null）判定 —— 语义即「开关关闭」。 */
function isAbsent(v: unknown): boolean {
  return v === undefined || v === null;
}

/** 读取截断目标维度：缺省/null → 关闭（null）；非正整数直接拒（S2）。 */
function readTruncationDims(section: Record<string, unknown>): number | null {
  const v = section.truncation_dims;
  if (isAbsent(v)) return null;
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    throw new TypeError(`embedding.truncation_dims 必须是正整数，收到 ${JSON.stringify(v)}`);
  }
  return v;
}

/** 默认 embedding 模型声明的 mrlDims（无声明视为空域）。 */
function declaredMrlDims(models: ModelsSettings): number[] {
  const entry = models.available.find((m) => m.id === models.defaults.embedding);
  return entry?.embedding?.mrlDims ?? [];
}

/** 目标维度必须落在 mrlDims 声明域内（r493）。 */
function assertTruncationDomain(target: number, models: ModelsSettings): void {
  const dims = declaredMrlDims(models);
  if (dims.length === 0) {
    throw new Error(
      `embedding.truncation_dims=${target} 需要默认 embedding 模型（${models.defaults.embedding ?? '未配置'}）声明 embedding.mrlDims`,
    );
  }
  if (!dims.includes(target)) {
    throw new Error(
      `embedding.truncation_dims=${target} 不在模型 ${models.defaults.embedding} 声明的 mrlDims [${dims.join('/')}] 内`,
    );
  }
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
