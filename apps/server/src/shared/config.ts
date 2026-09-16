import { desc, ModelsSettingsSchema, ProviderConfigSchema } from '@crystalith/shared';
// Configuration SSOT entry. Reads config/app.yaml, renders `{{ env.* }}`
// template expressions, and validates against the shared Zod schemas. The
// result is a typed `AppConfig` consumed by the AI runtime (provider
// registry) and the models management endpoint.
//
// YAML anchors (&name / <<: *name) are handled natively by the `yaml` parser.
//
// Module map (W9 split; this file stays the only import surface):
//   config-env.ts       — CL_* env + .env overlay + config path resolution
//   config-template.ts  — `{{ }}` template expression engine
//   config-load.ts      — AppConfig load/singleton + parseSection
//   config-settings.ts  — models + per-domain typed settings & accessors
//   config-research.ts  — research: section (defaults SSOT, r249 aliases)
//   config.ts (here)    — RootConfigSchema (app.schema.gen.json source)
import { z } from 'zod';

import { RESEARCH_SETTINGS_DEFAULTS, ResearchSettingsSchema } from './config-research.ts';
import {
  AiSettingsSchema,
  AppSettingsSchema,
  CacheSettingsSchema,
  CompletionOptionsSchema,
  ConcurrencySettingsSchema,
  ContextWindowSettingsSchema,
  DatabaseSettingsSchema,
  EmbeddingSettingsSchema,
  OptionalServicesSchema,
  PluginsSettingsSchema,
  ProxySettingsSchema,
  SearchSettingsSchema,
  SlidesPreviewSchema,
  SsrfPolicyConfigSchema,
  StorageSettingsSchema,
} from './config-settings.ts';

export * from './config-env.ts';
export * from './config-template.ts';
export * from './config-load.ts';
export * from './config-settings.ts';
export * from './config-research.ts';

// ===========================================================================
// Root config schema — single combined schema for app.yaml generation
// (gen-app-schema.ts consumes this instead of a manual section mapping).
// Each section carries an inline .describe() for JSON Schema doc.
// ===========================================================================

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
          // v2 extractors: readability (built-in) / jina / firecrawl — see
          // shared/extraction/factory.ts. Only availability-relevant fields
          // are read here: `enabled: false` marks an extractor unavailable,
          // api_key/base_url feed extractor credential resolution.
          jina: z.object({
            enabled: z.boolean().default(true).optional(),
            api_key: z.string().default('').optional(),
          }),
          firecrawl: z.object({
            enabled: z.boolean().default(false).optional(),
            api_key: z.string().default('').optional(),
            base_url: z.string().default('').optional(),
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
  slides_preview: SlidesPreviewSchema.describe(
    desc(
      'root.slides_preview',
      'Slidev 预览可达性探测：SLIDES 工具可用性诊断（/v2/workspace/tools diagnostics.slides）的唯一数据源',
    ),
  ),
  database: DatabaseSettingsSchema.describe(desc('root.database', '数据库设置（v1 兼容）')),
  plugins: PluginsSettingsSchema.describe(desc('root.plugins', '插件发现与加载配置')),
  proxy_settings: ProxySettingsSchema.describe(desc('root.proxy_settings', '出站代理设置')),
  research: ResearchSettingsSchema.default(RESEARCH_SETTINGS_DEFAULTS).describe(
    desc(
      'root.research',
      'Deep Research 运行时：进度账本保留、支路并行度、读页预算比、加购公式、work_unit 步数、token 预算、可选拆解模型等',
    ),
  ),
});
export type RootConfig = z.infer<typeof RootConfigSchema>;
