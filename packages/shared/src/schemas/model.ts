// Model + provider configuration schemas — consumed by the AI runtime
// provider registry and the models management endpoint.
// Mirrors v1 `shared.config.models` (Continue-inspired) but simplified for the
// Vercel AI SDK provider registry: provider is a registry key resolved via
// dynamic import, not a hardcoded switch.
import { z } from 'zod';

import { JsonMetadataSchema } from './common.js';

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
  .catchall(z.unknown());
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
// Model configuration (a single entry in `models.available`)
// ---------------------------------------------------------------------------

export const ModelConfigSchema = z.object({
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
  /** Extra passthrough for provider-specific knobs. */
  providerOptions: JsonMetadataSchema.optional(),
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
          code: z.ZodIssueCode.custom,
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

export const ModelInfoSchema = z.object({
  id: z.string(),
  provider: z.string(),
  model: z.string(),
  displayName: z.string(),
  description: z.string(),
  roles: z.array(ModelRoleSchema),
  capabilities: z.array(ModelCapabilitySchema),
  isDefaultChat: z.boolean(),
  isDefaultEmbedding: z.boolean(),
});
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

export const ModelListSchema = z.object({
  defaults: ModelDefaultsSchema,
  providers: z.array(z.string()).default([]),
  models: z.array(ModelInfoSchema),
});
export type ModelList = z.infer<typeof ModelListSchema>;

/** Query for GET /v2/models — optional role filter. */
export const ModelListQuerySchema = z.object({
  role: ModelRoleSchema.optional(),
  /** Legacy/unused client param — accepted and ignored. */
  capability: z.string().optional(),
});
export type ModelListQuery = z.infer<typeof ModelListQuerySchema>;

export const ModelProvidersResponseSchema = z.object({
  providers: z.array(z.string()),
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
