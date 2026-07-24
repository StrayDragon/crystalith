/**
 * createOpenAI() returns a callable function with .embedding attached.
 * resolveEmbeddingModel must not require typeof === 'object' (isRecord).
 */
import { describe, expect, it, mock } from 'bun:test';

const fakeEmbeddingModel = { modelId: 'fake-embed' };

mock.module('@ai-sdk/openai', () => ({
  createOpenAI: () => {
    const provider = Object.assign((id: string) => ({ modelId: id }), {
      embedding: (id: string) => ({ ...fakeEmbeddingModel, modelId: id }),
      chat: (id: string) => ({ modelId: id }),
    });
    return provider;
  },
}));

mock.module('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: () => {
    const provider = Object.assign((id: string) => ({ modelId: id }), {
      embeddingModel: (id: string) => ({ ...fakeEmbeddingModel, modelId: id }),
      textEmbeddingModel: (id: string) => ({ ...fakeEmbeddingModel, modelId: `text-${id}` }),
      chatModel: (id: string) => ({ modelId: id }),
      languageModel: (id: string) => ({ modelId: id }),
    });
    return provider;
  },
}));

import { resolveEmbeddingModel } from '../../src/ai/providers.ts';

describe('resolveEmbeddingModel provider accessors', () => {
  it('resolves .embedding on callable @ai-sdk/openai providers', async () => {
    const model = await resolveEmbeddingModel({
      id: 'test-openai-embed',
      provider: 'openai',
      model: 'text-embedding-3-small',
      displayName: 't',
      description: '',
      roles: ['embed'],
      capabilities: [],
      providerConfig: { apiKey: 'sk', baseUrl: 'http://example.invalid/v1' },
    });
    expect((model as { modelId: string }).modelId).toBe('text-embedding-3-small');
  });

  it('resolves .embeddingModel on openai-compatible providers', async () => {
    const model = await resolveEmbeddingModel({
      id: 'test-compat-embed',
      provider: 'openai-compatible',
      model: 'bge-m3-mlx-8bit',
      displayName: 't',
      description: '',
      roles: ['embed'],
      capabilities: [],
      providerConfig: { apiKey: 'sk', baseUrl: 'http://example.invalid/v1' },
    });
    expect((model as { modelId: string }).modelId).toBe('bge-m3-mlx-8bit');
  });
});
