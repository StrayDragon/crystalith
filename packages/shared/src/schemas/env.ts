// @crystalith/shared — Environment variable schema SSOT.
//
// Single source of truth for all environment variables used by Crystalith v2.
// The gen-env-examples.ts script consumes this to auto-generate:
//   - .env.example              (build-run group → .env file)
//   - config/secret.env.example  (secrets group → config/secret.env)
//
// When adding a new env var:
//   1. Add it here with .describe() and an appropriate default
//   2. Run `just gen-env-examples` to regenerate .example files
//   3. Run `just gen-app-schema` to regenerate JSON Schema if config is affected
//
// NEVER edit .example files manually — they are generated artifacts.

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Target file classification
// ---------------------------------------------------------------------------

/**
 * Target file for each env var group.
 * - `build-run`: non-secret build/run parameters → `.env`
 * - `secrets`: API keys and tokens → `config/secret.env`
 */
export const EnvTarget = {
  BuildRun: 'build-run',
  Secrets: 'secrets',
} as const;
export type EnvTarget = (typeof EnvTarget)[keyof typeof EnvTarget];

// ---------------------------------------------------------------------------
// Build-run env vars (→ .env)
// Non-secret parameters controlling server, build, and runtime behavior.
// ---------------------------------------------------------------------------

export const BuildRunEnvSchema = z.object({
  // --- Server ---
  CL_SERVER_PORT: z.coerce.number().default(8032).describe('Elysia 服务器监听端口。默认 8032。'),

  CL_SERVER_HOST: z
    .string()
    .default('127.0.0.1')
    .describe('Elysia 服务器监听地址。默认 127.0.0.1（仅本地）。生产部署设为 0.0.0.0。'),

  // --- Paths ---
  CL_DATA_ROOT: z
    .string()
    .default('./data')
    .describe('所有运行时文件的统一数据根目录（DB、slides、uploads）。相对路径从 CWD 解析。'),

  CL_DB_PATH: z
    .string()
    .default('')
    .describe('SQLite 数据库文件路径。默认派生自 CL_DATA_ROOT → storage.data_root。'),

  CL_CONFIG_PATH: z
    .string()
    .default('config/app.yaml')
    .describe('YAML 配置文件路径。默认 config/app.yaml。'),

  CL_SECRET_PATH: z
    .string()
    .default('config/secret.env')
    .describe('密钥文件路径。默认 config/secret.env。'),

  // --- API endpoints ---
  CL_CHAT_API_BASE: z
    .string()
    .default('')
    .describe('OpenAI-compatible 聊天 API base URL。默认由 config/app.yaml 提供。'),

  CL_EMBEDDING_API_BASE: z
    .string()
    .default('')
    .describe('OpenAI-compatible 嵌入 API base URL。默认由 config/app.yaml 提供。'),

  OPENAI_BASE_URL: z
    .string()
    .default('')
    .describe('OpenAI 兼容 API base URL（通用）。留空使用默认 https://api.openai.com/v1。'),

  // --- Model overrides ---
  CL_DEFAULT_CHAT_MODEL: z
    .string()
    .default('')
    .describe('默认聊天模型 ID。覆盖 config/app.yaml 中 models.defaults.chat。'),

  CL_DEFAULT_EMBEDDING_MODEL: z
    .string()
    .default('')
    .describe('默认嵌入模型 ID。覆盖 config/app.yaml 中 models.defaults.embedding。'),

  CL_CHAT_MODEL: z
    .string()
    .default('')
    .describe('主聊天模型名称（gateway-chat-primary 的 model 字段）。'),

  CL_CHAT_LIGHT_MODEL: z
    .string()
    .default('')
    .describe('轻量聊天模型名称（gateway-chat-light 的 model 字段）。'),

  CL_EMBEDDING_MODEL: z
    .string()
    .default('')
    .describe('嵌入模型名称（gateway-embedding 的 model 字段）。'),

  // --- Search ---
  CL_SEARXNG_HOST: z
    .string()
    .default('')
    .describe('SearXNG 实例 URL。覆盖 config/app.yaml 中 search.searxng.host。留空禁用。'),

  // --- Frontend ---
  VITE_API_PROXY_TARGET: z
    .string()
    .default('http://127.0.0.1:8032')
    .describe('Vite 开发服务器 API 代理目标地址。仅前端构建时使用。'),
});

export type BuildRunEnv = z.infer<typeof BuildRunEnvSchema>;

// ---------------------------------------------------------------------------
// Deprecated / backward-compat env vars (→ .env)
// Pre-v2 env vars kept for backward compatibility. New code MUST use CL_*
// variants. Listed at the bottom of .env.example under "# --- Deprecated ---".
// ---------------------------------------------------------------------------

export const DeprecatedEnvSchema = z.object({
  SEARXNG_HOST: z
    .string()
    .default('')
    .describe('[DEPRECATED] 使用 CL_SEARXNG_HOST。SearXNG 实例 URL。'),

  POSTGRES_PASSWORD: z
    .string()
    .default('')
    .describe('[DEPRECATED] v1 Postgres 密码。v2 使用 SQLite，仅保留用于 v1 兼容。'),

  JINA_API_KEY: z
    .string()
    .default('')
    .describe('[DEPRECATED] Jina Reader API 密钥。建议通过 config/secret.env 管理。'),

  FIRECRAWL_API_KEY: z
    .string()
    .default('')
    .describe('[DEPRECATED] Firecrawl API 密钥。建议通过 config/secret.env 管理。'),

  BROWSERLESS_TOKEN: z
    .string()
    .default('')
    .describe('[DEPRECATED] Browserless token。建议通过 config/secret.env 管理。'),
});

export type DeprecatedEnv = z.infer<typeof DeprecatedEnvSchema>;

// ---------------------------------------------------------------------------
// Secrets env vars (→ config/secret.env)
// API keys and tokens. This file is gitignored.
// ---------------------------------------------------------------------------

export const SecretsEnvSchema = z.object({
  CL_CHAT_API_KEY: z
    .string()
    .default('')
    .describe('LLM 聊天 API 密钥。推荐通过 ~/.bashrc 导出 CL_CHAT_API_KEY 环境变量。'),

  CL_EMBEDDING_API_KEY: z
    .string()
    .default('')
    .describe('LLM 嵌入 API 密钥。推荐通过 ~/.bashrc 导出 CL_EMBEDDING_API_KEY 环境变量。'),

  CRYSTALITH_API_KEY: z
    .string()
    .default('')
    .describe('Crystalith 自托管 API 密钥（可选）。启用 app.auth 时用于 Bearer 认证。'),

  OPENAI_API_KEY: z
    .string()
    .default('')
    .describe('OpenAI API 密钥。用于直接 OpenAI 调用（非 gateway）。'),

  ANTHROPIC_API_KEY: z
    .string()
    .default('')
    .describe('Anthropic API 密钥。用于直接 Anthropic 调用。'),

  GOOGLE_GENERATIVE_AI_API_KEY: z
    .string()
    .default('')
    .describe('Google Generative AI API 密钥。用于直接 Google 调用。'),
});

export type SecretsEnv = z.infer<typeof SecretsEnvSchema>;

// ---------------------------------------------------------------------------
// Composite schema (combined for validation or bulk operations)
// ---------------------------------------------------------------------------

/**
 * All env vars merged into one flat schema.
 * Useful for runtime validation of the full environment.
 */
export const AllEnvSchema = BuildRunEnvSchema.merge(DeprecatedEnvSchema).merge(SecretsEnvSchema);
export type AllEnv = z.infer<typeof AllEnvSchema>;

// ---------------------------------------------------------------------------
// Metadata for generator scripts
// ---------------------------------------------------------------------------

/**
 * Entry descriptor used by gen-env-examples.ts to produce .example files.
 */
export interface EnvEntryDescriptor {
  key: string;
  description: string;
  target: EnvTarget;
  default: string;
  deprecated?: boolean;
}

/**
 * Extract typed descriptors from a Zod schema for auto-generation.
 */
function extractDescriptors(
  schema: z.ZodObject<z.ZodRawShape>,
  target: EnvTarget,
  deprecated?: boolean,
): EnvEntryDescriptor[] {
  const shape = schema.shape;
  return Object.entries(shape).map(([key, field]) => ({
    key,
    description: (field as { description?: string }).description ?? '',
    target,
    default: '',
    deprecated,
  }));
}

/**
 * Complete list of all env var descriptors, ordered: build-run → deprecated → secrets.
 * Consumed by gen-env-examples.ts.
 */
export function getAllEnvDescriptors(): EnvEntryDescriptor[] {
  return [
    ...extractDescriptors(BuildRunEnvSchema, EnvTarget.BuildRun),
    ...extractDescriptors(DeprecatedEnvSchema, EnvTarget.BuildRun, true),
    ...extractDescriptors(SecretsEnvSchema, EnvTarget.Secrets),
  ];
}
