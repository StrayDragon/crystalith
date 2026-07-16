import { ModelListSchema } from '@crystalith/shared';
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
    summary: 'List available models and defaults',
    tags: ['models'],
    responses: {
      200: { description: 'Available model configurations', body: ModelListSchema },
    },
  },
  {
    path: '/v2/models/providers',
    method: 'get',
    summary: 'List supported AI providers',
    tags: ['models'],
    responses: { 200: { description: 'Provider list' } },
  },
];

registerApiDoc(apiDocs);

export const modelsRouter = new Elysia({ prefix: '/v2' })
  .get('/models', ({ query }) => {
    const models = getModels();
    const defaults = getModelDefaults();
    const roleFilter = (query as { role?: string }).role;
    // c52: filter by provider availability (v1 api.py:83 plugins.is_provider_available)
    // and optional role. Unknown-provider models are excluded from the list.
    let available = models.available.filter((m) => isKnownProvider(m.provider));
    if (roleFilter) {
      available = available.filter((m) => m.roles.includes(roleFilter as 'chat' | 'embed'));
    }
    return {
      // c52: v1 ModelsListResponse (api.py:42-43,95-97) puts defaults + providers
      // on the envelope. providers = sorted({openai} ∪ knownProviders()).
      default_chat: defaults.chat,
      default_embedding: defaults.embedding,
      providers: [...new Set(['openai', ...knownProviders()])].toSorted(),
      models: available.map((m) => ({
        id: m.id,
        provider: m.provider,
        model: m.model,
        display_name: m.display_name,
        description: m.description,
        roles: m.roles,
        capabilities: m.capabilities,
      })),
    };
  })
  // GET single model (c39 gap fix — v1 api.py:101-112).
  // c52: filter by provider availability (v1 api.py:109-110 → 404 when unavailable).
  // v1 get_model returns bare ModelRead (no default info).
  .get('/models/:modelId', ({ params }) => {
    const model = getModelById(params.modelId);
    if (!model || !isKnownProvider(model.provider))
      throw new NotFoundError(`Model '${params.modelId}' not found`);
    return model;
  })
  .get('/models/providers', () => {
    return { providers: knownProviders() };
  });
