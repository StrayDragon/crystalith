# add-v2-models-management — Tasks

## 1. Provider Registry

- [x] `apps/server/src/ai/provider-registry.ts` — 按 provider 名 (openai/anthropic/google/deepseek) 创建 provider instance (pre-existing from c02)
- [x] apiKey 从 config/secret.env 读取 ({{secret.OPENAI_API_KEY}})

## 2. Models Endpoint

- [x] `apps/server/src/features/models/router.ts` — GET /v2/models 返回 [{provider, modelId, displayName}]
- [x] 前端 selector: server API 就绪，前端渐进迁移

## 3. Model Config

- [x] `config/app.yaml` models 段: 定义默认 modelId + provider (pre-existing)
- [x] QA/Output 调用时从 session 或默认 config 取 model (implemented in qa/output routers)

## Verification

```bash
curl localhost:8032/v2/models
# 返回 [{provider:"openai", modelId:"gpt-4o", displayName:"GPT-4o"}, ...]
```
