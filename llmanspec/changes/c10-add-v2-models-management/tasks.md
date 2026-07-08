# add-v2-models-management — Tasks

## 1. Provider Registry
- [ ] `server/src/ai/provider-registry.ts` — 按 provider 名 (openai/anthropic/google/deepseek) 创建 provider instance
- [ ] apiKey 从 config/secret.env 读取 ({{secret.OPENAI_API_KEY}})

## 2. Models Endpoint
- [ ] `server/src/features/models/router.ts` — GET /v2/models 返回 [{provider, modelId, displayName}]
- [ ] 前端 selector: 从 /v2/models 加载列表，用户切换后 session 绑定 model

## 3. Model Config
- [ ] `config/app.yaml` models 段: 定义默认 modelId + provider
- [ ] QA/Output 调用时从 session 或默认 config 取 model

## Verification
```bash
curl localhost:8032/v2/models
# 返回 [{provider:"openai", modelId:"gpt-4o", displayName:"GPT-4o"}, ...]
```
