// Model + provider configuration schemas — consumed by the AI runtime
// provider registry and the models management endpoint.
// Mirrors v1 `shared.config.models` (Continue-inspired) but simplified for the
// Vercel AI SDK provider registry: provider is a registry key resolved via
// dynamic import, not a hardcoded switch.
import { z } from 'zod';

import { JsonMetadataSchema } from './common.js';
import { desc } from './i18n.js';

// ---------------------------------------------------------------------------
// Provider config (OpenAI-compatible baseline; extra keys allowed for other SDKs)
// ---------------------------------------------------------------------------

export const ProviderConfigSchema = z
  .object({
    apiKey: z.string().nullable().optional(),
    baseUrl: z.string().nullable().optional(),
    organization: z.string().nullable().optional(),
    project: z.string().nullable().optional(),
  })
  .catchall(z.unknown())
  .openapi({
    description: desc('model.provider_config', '模型 Provider 配置'),
  });
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

// ---------------------------------------------------------------------------
// Completion + request options
// ---------------------------------------------------------------------------

export const CompletionOptionsSchema = z.object({
  contextLength: z.number().int().positive().nullable().optional(),
  maxTokens: z.number().int().positive().nullable().optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  topP: z.number().min(0).max(1).nullable().optional(),
  topK: z.number().int().nonnegative().nullable().optional(),
  stop: z.array(z.string()).nullable().optional(),
  reasoning: z.boolean().nullable().optional(),
});
export type CompletionOptions = z.infer<typeof CompletionOptionsSchema>;

export const RequestOptionsSchema = z.object({
  timeout: z.number().int().positive().nullable().optional(),
  verifySsl: z.boolean().default(true),
  proxy: z.string().nullable().optional(),
  headers: z.record(z.string(), z.string()).nullable().optional(),
});
export type RequestOptions = z.infer<typeof RequestOptionsSchema>;

// ---------------------------------------------------------------------------
// Model roles + capabilities
// ---------------------------------------------------------------------------

export const ModelRoleSchema = z.enum([
  'chat',
  'embed',
  'edit',
  'apply',
  'autocomplete',
  'summarize',
]);
export type ModelRole = z.infer<typeof ModelRoleSchema>;

export const ModelCapabilitySchema = z.enum([
  'tool_use',
  'image_input',
  'audio_input',
  'streaming',
]);
export type ModelCapability = z.infer<typeof ModelCapabilitySchema>;

// ---------------------------------------------------------------------------
// Embedding capability declaration (c130)
// ---------------------------------------------------------------------------

/**
 * Built-in embedding prefix preset names (catalog SSOT for schema validation).
 * The preset templates themselves live in the server embedding engine
 * (`apps/server/src/rag/embedding-engine.ts`) — names are shared here so
 * config validation and the engine stay in sync.
 */
export const EMBEDDING_PREFIX_PRESET_NAMES = ['embeddinggemma2'] as const;

export const ModelEmbeddingCapabilitySchema = z
  .object({
    dims: z.number().int().positive().describe(desc('model.embedding_dims', '嵌入维度（正整数）')),
    mrlDims: z
      .array(z.number().int().positive())
      .optional()
      .describe(desc('model.embedding_mrl_dims', 'MRL 可选维度列表（仅声明与透出，无截断行为）')),
    modalities: z
      .array(z.string())
      .default(['text'])
      .describe(desc('model.embedding_modalities', '支持的输入模态（默认仅 text）')),
    textOnlyLoad: z
      .boolean()
      .optional()
      .describe(desc('model.embedding_text_only_load', '是否仅接受文本输入加载')),
    prefixPreset: z
      .enum(EMBEDDING_PREFIX_PRESET_NAMES, {
        error: (iss) =>
          `未知的前缀预设名：${String(iss.input)}（合法值：${EMBEDDING_PREFIX_PRESET_NAMES.join('、')}）`,
      })
      .optional()
      .describe(desc('model.embedding_prefix_preset', '任务前缀内置预设名（engine 侧模板）')),
  })
  .openapi({
    description: desc('model.embedding_capability', 'embedding 能力声明块（目录 SSOT）'),
  });
export type ModelEmbeddingCapability = z.infer<typeof ModelEmbeddingCapabilitySchema>;

// ---------------------------------------------------------------------------
// Model configuration (a single entry in `models.available`)
// ---------------------------------------------------------------------------

export const ModelConfigSchema = z
  .object({
    id: z.string().min(1),
    /** Registry key: openai | anthropic | google | deepseek | openai-compatible | groq | together | bedrock | <custom> */
    provider: z.string().min(1),
    model: z.string().min(1),
    displayName: z.string().min(1),
    description: z.string().default(''),
    roles: z.array(ModelRoleSchema).default(['chat']),
    capabilities: z.array(ModelCapabilitySchema).default([]),
    providerConfig: ProviderConfigSchema.nullable().optional(),
    completionOptions: CompletionOptionsSchema.nullable().optional(),
    requestOptions: RequestOptionsSchema.nullable().optional(),
    /** Advanced escape hatch: override the SDK package + factory directly. */
    sdk: z.string().optional(),
    factory: z.string().optional(),
    /** Embedding capability declaration (dims / prefixPreset / ...; c130). */
    embedding: ModelEmbeddingCapabilitySchema.nullable().optional(),
    /** Extra passthrough for provider-specific knobs. */
    providerOptions: JsonMetadataSchema.optional(),
  })
  .openapi({
    description: desc('model.config', 'models.available 单条配置'),
  });
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

// ---------------------------------------------------------------------------
// Defaults + the full `models:` section of app.yaml
// ---------------------------------------------------------------------------

export const ModelDefaultsSchema = z.object({
  chat: z.string().nullable().optional(),
  embedding: z.string().nullable().optional(),
  edit: z.string().nullable().optional(),
  autocomplete: z.string().nullable().optional(),
});
export type ModelDefaults = z.infer<typeof ModelDefaultsSchema>;

export const ModelsSettingsSchema = z
  .object({
    defaults: ModelDefaultsSchema.default({}),
    available: z.array(ModelConfigSchema).default([]),
  })
  .superRefine((val, ctx) => {
    const ids = new Set(val.available.map((m) => m.id));
    for (const role of ['chat', 'embedding', 'edit', 'autocomplete'] as const) {
      const defId = val.defaults[role];
      if (defId && !ids.has(defId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Default ${role} model '${defId}' not found in models.available`,
          path: ['defaults', role],
        });
      }
    }
  });
export type ModelsSettings = z.infer<typeof ModelsSettingsSchema>;

// ---------------------------------------------------------------------------
// Read-only model info exposed by GET /v2/models
// ---------------------------------------------------------------------------

export const ModelInfoSchema = z
  .object({
    id: z.string(),
    provider: z.string(),
    model: z.string(),
    displayName: z.string(),
    description: z.string(),
    roles: z.array(ModelRoleSchema),
    capabilities: z.array(ModelCapabilitySchema),
    isDefaultChat: z.boolean(),
    isDefaultEmbedding: z.boolean(),
    /** Embedding capability declaration passthrough (additive, c130). */
    embedding: ModelEmbeddingCapabilitySchema.nullable().optional(),
  })
  .openapi({
    description: desc('model.info', 'GET /v2/models 只读模型信息'),
  });
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

export const ModelListSchema = z
  .object({
    defaults: ModelDefaultsSchema,
    providers: z.array(z.string()).default([]),
    models: z.array(ModelInfoSchema),
  })
  .openapi({
    description: desc('model.list', '模型列表响应'),
  });
export type ModelList = z.infer<typeof ModelListSchema>;

/** Query for GET /v2/models — optional role filter. */
export const ModelListQuerySchema = z
  .object({
    role: ModelRoleSchema.optional(),
  })
  .openapi({
    description: desc('model.list_query', '模型列表查询参数'),
  });
export type ModelListQuery = z.infer<typeof ModelListQuerySchema>;

export const ModelProvidersResponseSchema = z
  .object({
    providers: z.array(z.string()),
  })
  .openapi({
    description: desc('model.providers', '已注册 Provider 列表'),
  });
export type ModelProvidersResponse = z.infer<typeof ModelProvidersResponseSchema>;

// ---------------------------------------------------------------------------
// Provider registry whitelist (mirrors server-side KNOWN_PROVIDERS)
// ---------------------------------------------------------------------------

export const KnownProviderSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'openai-compatible',
  'groq',
  'together',
  'bedrock',
]);
export type KnownProvider = z.infer<typeof KnownProviderSchema>;
