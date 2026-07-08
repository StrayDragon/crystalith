## Approach

### GET /v2/models

From `config/app.yaml` → display available models:

```ts
interface ModelInfo {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  roles: ('chat' | 'embed' | 'edit')[];
  capabilities: ('tool_use' | 'vision')[];
}

// GET /v2/models → ModelInfo[]
```

### Config format (from Phase 2 provider registry)

```yaml
models:
  defaults: { chat: 'gpt-4o', embedding: 'text-embedding-3-small' }
  available:
    - id: 'gpt-4o'
      provider: 'openai'
      model: 'gpt-4o'
      displayName: 'GPT-4o'
      roles: [chat, edit]
      capabilities: [tool_use]
      options: { temperature: 0.7, maxTokens: 4096 }
      # apiKey is resolved from config/secret.env or env vars
    - id: 'gateway-embedding'
      provider: 'openai-compatible'
      model: 'bge-m3'
      displayName: 'BGE-M3 (Local)'
      roles: [embed]
```

### Provider resolution (Phase 2 ai-runtime)

All model → provider resolution is done by `resolveModel(config)` from Phase 2.
This feature is **read-only** — the model list is derived from config, not from DB CRUD.
