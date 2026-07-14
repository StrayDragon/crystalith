// Provider registry — config-driven model resolution via dynamic import.
//
// A whitelist maps `provider` keys to `{ sdk, factory }` npm package +
// factory function names. `resolveModel(config)` dynamically imports the SDK
// and returns a `LanguageModelV4`. No switch-case hardcoding — adding a
// provider is one registry entry + one `bun add`.
//
// 90% of providers (local gateways, DeepSeek, Groq, Together, etc.) route
// through `openai-compatible` via `createOpenAICompatible`. The `openai`
// entry uses the official `@ai-sdk/openai` for Responses API + organization
// support.
import type { LanguageModelV4, EmbeddingModelV4 } from '@ai-sdk/provider';
import type { ModelConfig } from '@crystalith/shared';

interface ProviderEntry {
  sdk: string;
  factory: string;
}

const KNOWN_PROVIDERS: Record<string, ProviderEntry> = {
  openai: { sdk: '@ai-sdk/openai', factory: 'createOpenAI' },
  anthropic: { sdk: '@ai-sdk/anthropic', factory: 'createAnthropic' },
  google: { sdk: '@ai-sdk/google', factory: 'createGoogleGenerativeAI' },
  deepseek: { sdk: '@ai-sdk/deepseek', factory: 'createDeepSeek' },
  'openai-compatible': {
    sdk: '@ai-sdk/openai-compatible',
    factory: 'createOpenAICompatible',
  },
  groq: { sdk: '@ai-sdk/openai-compatible', factory: 'createOpenAICompatible' },
  together: { sdk: '@ai-sdk/openai-compatible', factory: 'createOpenAICompatible' },
  bedrock: { sdk: '@ai-sdk/amazon-bedrock', factory: 'createAmazonBedrock' },
};

/** Resolve a ModelConfig into a concrete LanguageModelV4. */
export async function resolveModel(config: ModelConfig): Promise<LanguageModelV4> {
  const entry = KNOWN_PROVIDERS[config.provider];

  const sdk = entry?.sdk ?? config.sdk;
  const factory = entry?.factory ?? config.factory;

  if (!sdk || !factory) {
    throw new Error(
      `Unknown provider '${config.provider}' and no sdk/factory override on model '${config.id}'`,
    );
  }

  const mod = (await import(sdk)) as Record<string, unknown>;
  const factoryFn = mod[factory];
  if (typeof factoryFn !== 'function') {
    throw new TypeError(`Factory '${factory}' not found in '${sdk}'`);
  }

  const providerConfig = config.provider_config ?? {};
  const opts: Record<string, unknown> = {
    apiKey: resolveApiKey(providerConfig.api_key),
    baseURL: providerConfig.base_url || undefined,
    organization: providerConfig.organization || undefined,
    project: providerConfig.project || undefined,
    headers: config.request_options?.headers ?? undefined,
    supportsStructuredOutputs: providerConfig.supportsStructuredOutputs ?? false,
  };

  // Create the provider instance, then select the model by id.
  const provider = (factoryFn as (o: Record<string, unknown>) => unknown)(opts);

  // Most AI SDK providers are callable: `provider(modelId)`.
  if (typeof provider === 'function') {
    return (provider as (id: string) => LanguageModelV4)(config.model);
  }

  // Fallback: `.chat(modelId)` or `.languageModel(modelId)`.
  if (provider && typeof (provider as { chat?: unknown }).chat === 'function') {
    return (provider as { chat: (id: string) => LanguageModelV4 }).chat(config.model);
  }
  if (provider && typeof (provider as { languageModel?: unknown }).languageModel === 'function') {
    return (provider as { languageModel: (id: string) => LanguageModelV4 }).languageModel(
      config.model,
    );
  }

  throw new Error(`Provider from '${sdk}' is neither callable nor has .chat()/.languageModel()`);
}

/** Resolve an embedding model (same provider mechanism, .embedding() accessor). */
export async function resolveEmbeddingModel(config: ModelConfig): Promise<EmbeddingModelV4> {
  const entry = KNOWN_PROVIDERS[config.provider];

  const sdk = entry?.sdk ?? config.sdk;
  const factory = entry?.factory ?? config.factory;

  if (!sdk || !factory) {
    throw new Error(`Unknown provider for embedding model '${config.id}'`);
  }

  const mod = (await import(sdk)) as Record<string, unknown>;
  const factoryFn = mod[factory];
  if (typeof factoryFn !== 'function') {
    throw new TypeError(`Factory '${factory}' not found in '${sdk}'`);
  }

  const providerConfig = config.provider_config ?? {};
  const opts: Record<string, unknown> = {
    apiKey: resolveApiKey(providerConfig.api_key),
    baseURL: providerConfig.base_url || undefined,
    organization: providerConfig.organization || undefined,
    project: providerConfig.project || undefined,
    supportsStructuredOutputs: providerConfig.supportsStructuredOutputs ?? false,
  };

  const provider = (factoryFn as (o: Record<string, unknown>) => unknown)(opts);

  if (provider && typeof (provider as { embedding?: unknown }).embedding === 'function') {
    return (provider as { embedding: (id: string) => EmbeddingModelV4 }).embedding(config.model);
  }

  throw new Error(`Provider from '${sdk}' has no .embedding() accessor`);
}

/** Resolve an API key — may be empty string (some local gateways don't need one). */
function resolveApiKey(key: string | null | undefined): string | undefined {
  if (key === null || key === undefined) return undefined;
  return key;
}

/** List of known provider keys (for UI / validation). */
export function knownProviders(): string[] {
  return Object.keys(KNOWN_PROVIDERS);
}

/** Check whether a provider key is in the registry. */
export function isKnownProvider(provider: string): boolean {
  return provider in KNOWN_PROVIDERS;
}
