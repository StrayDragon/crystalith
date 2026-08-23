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

export const KNOWN_PROVIDERS = {
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
} as const satisfies Record<string, ProviderEntry>;

type ProviderFactory = (opts: Record<string, unknown>) => unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Dynamic SDK import + factory lookup — one cast wall at the module boundary. */
async function loadProviderFactory(sdk: string, factory: string): Promise<ProviderFactory> {
  const mod: unknown = await import(sdk);
  if (!isRecord(mod)) {
    throw new TypeError(`Module '${sdk}' did not export an object`);
  }
  const factoryFn = mod[factory];
  if (typeof factoryFn !== 'function') {
    throw new TypeError(`Factory '${factory}' not found in '${sdk}'`);
  }
  return factoryFn as ProviderFactory;
}

function resolveChatModel(provider: unknown, modelId: string, sdk: string): LanguageModelV4 {
  if (typeof provider === 'function') {
    return (provider as (id: string) => LanguageModelV4)(modelId);
  }
  if (isRecord(provider) && typeof provider.chat === 'function') {
    return (provider.chat as (id: string) => LanguageModelV4)(modelId);
  }
  if (isRecord(provider) && typeof provider.languageModel === 'function') {
    return (provider.languageModel as (id: string) => LanguageModelV4)(modelId);
  }
  throw new Error(`Provider from '${sdk}' is neither callable nor has .chat()/.languageModel()`);
}

/**
 * Resolve an embedding model from a provider instance.
 *
 * `@ai-sdk/openai` `createOpenAI()` returns a *callable function* with
 * `.embedding` / `.embeddingModel` attached. `typeof fn === 'function'`, so
 * a plain `isRecord` check misses those accessors (openai-compatible exposes
 * `.embeddingModel` / `.textEmbeddingModel` only).
 */
function resolveEmbeddingAccessor(
  provider: unknown,
  modelId: string,
  sdk: string,
): EmbeddingModelV4 {
  const accessors = ['embedding', 'embeddingModel', 'textEmbeddingModel'] as const;
  for (const key of accessors) {
    const candidate =
      typeof provider === 'function' || isRecord(provider)
        ? (provider as Record<string, unknown>)[key]
        : undefined;
    if (typeof candidate === 'function') {
      return (candidate as (id: string) => EmbeddingModelV4)(modelId);
    }
  }
  throw new Error(
    `Provider from '${sdk}' has no .embedding()/.embeddingModel()/.textEmbeddingModel() accessor`,
  );
}

function buildProviderOpts(config: ModelConfig, includeHeaders: boolean): Record<string, unknown> {
  const providerConfig = config.providerConfig ?? {};
  /* oxlint-disable typescript/prefer-nullish-coalescing -- empty config strings become undefined */
  return {
    apiKey: resolveApiKey(providerConfig.apiKey),
    baseURL: providerConfig.baseUrl || undefined,
    organization: providerConfig.organization || undefined,
    project: providerConfig.project || undefined,
    ...(includeHeaders ? { headers: config.requestOptions?.headers ?? undefined } : {}),
    supportsStructuredOutputs: providerConfig.supportsStructuredOutputs ?? false,
  };
  /* oxlint-enable typescript/prefer-nullish-coalescing */
}

/** Resolve a ModelConfig into a concrete LanguageModelV4. */
export async function resolveModel(config: ModelConfig): Promise<LanguageModelV4> {
  const entry = KNOWN_PROVIDERS[config.provider as keyof typeof KNOWN_PROVIDERS];

  const sdk = entry?.sdk ?? config.sdk;
  const factory = entry?.factory ?? config.factory;

  if (!sdk || !factory) {
    throw new Error(
      `Unknown provider '${config.provider}' and no sdk/factory override on model '${config.id}'`,
    );
  }

  const factoryFn = await loadProviderFactory(sdk, factory);
  const provider = factoryFn(buildProviderOpts(config, true));
  return resolveChatModel(provider, config.model, sdk);
}

/** Resolve an embedding model (same provider mechanism, .embedding() accessor). */
export async function resolveEmbeddingModel(config: ModelConfig): Promise<EmbeddingModelV4> {
  const entry = KNOWN_PROVIDERS[config.provider as keyof typeof KNOWN_PROVIDERS];

  const sdk = entry?.sdk ?? config.sdk;
  const factory = entry?.factory ?? config.factory;

  if (!sdk || !factory) {
    throw new Error(`Unknown provider for embedding model '${config.id}'`);
  }

  const factoryFn = await loadProviderFactory(sdk, factory);
  const provider = factoryFn(buildProviderOpts(config, false));
  return resolveEmbeddingAccessor(provider, config.model, sdk);
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
