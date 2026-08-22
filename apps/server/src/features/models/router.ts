import {
  ModelConfigSchema,
  ModelListQuerySchema,
  ModelListSchema,
  ModelProvidersResponseSchema,
} from '@crystalith/shared';
// Models router — /v2/models (read-only from config)
//
// Returns the list of available models from config/app.yaml via the AI
// provider registry. Provider resolution is done by ai/providers.ts.
// This endpoint is read-only — models are defined in config, not DB CRUD.
import { Elysia, NotFoundError } from 'elysia';

import { isKnownProvider, knownProviders } from '../../ai/providers.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { getModels, getModelDefaults, getModelById } from '../../shared/config.ts';

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/models',
    method: 'get',
    summary: '列出可用模型与默认项（来自配置）',
    tags: ['models'],
    responses: {
      200: { description: '模型列表', body: ModelListSchema },
    },
  },
  {
    path: '/v2/models/providers',
    method: 'get',
    summary: '列出已支持的 AI Provider',
    tags: ['models'],
    responses: { 200: { description: 'Provider 列表', body: ModelProvidersResponseSchema } },
  },
  {
    path: '/v2/models/:modelId',
    method: 'get',
    summary: '按 id 获取单个模型配置（provider 不可用时视为不存在）',
    tags: ['models'],
    responses: { 200: { description: '模型配置', body: ModelConfigSchema } },
  },
];

registerApiDoc(apiDocs);

export const modelsRouter = new Elysia({ prefix: '/v2' })
  .get(
    '/models',
    ({ query }) => {
      const models = getModels();
      const defaults = getModelDefaults();
      const roleFilter = query.role;
      // c52: filter by provider availability (v1 api.py:83 plugins.is_provider_available)
      // and optional role. Unknown-provider models are excluded from the list.
      let available = models.available.filter((m) => isKnownProvider(m.provider));
      if (roleFilter) {
        available = available.filter((m) => m.roles.includes(roleFilter));
      }
      return {
        defaults: {
          chat: defaults.chat ?? null,
          embedding: defaults.embedding ?? null,
          edit: defaults.edit ?? null,
          autocomplete: defaults.autocomplete ?? null,
        },
        providers: [...new Set(['openai', ...knownProviders()])].toSorted(),
        models: available.map((m) => ({
          id: m.id,
          provider: m.provider,
          model: m.model,
          displayName: m.displayName,
          description: m.description,
          roles: m.roles,
          capabilities: m.capabilities,
          isDefaultChat: m.id === defaults.chat,
          isDefaultEmbedding: m.id === defaults.embedding,
        })),
      };
    },
    { query: ModelListQuerySchema, response: ModelListSchema },
  )
  // GET single model (c39 gap fix — v1 api.py:101-112).
  // c52: filter by provider availability (v1 api.py:109-110 → 404 when unavailable).
  // v1 get_model returns bare ModelRead (no default info).
  .get(
    '/models/:modelId',
    ({ params }) => {
      const model = getModelById(params.modelId);
      if (!model || !isKnownProvider(model.provider))
        throw new NotFoundError(`Model '${params.modelId}' not found`);
      return model;
    },
    { response: ModelConfigSchema },
  )
  .get(
    '/models/providers',
    () => {
      return { providers: knownProviders() };
    },
    { response: ModelProvidersResponseSchema },
  );
