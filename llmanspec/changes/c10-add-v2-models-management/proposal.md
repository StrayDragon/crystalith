---
depends_on: [c04-add-v2-core-crud, c02-add-v2-ai-runtime]
batch: all
---

# c10-add-v2-models-management — 模型管理 (Provider + ModelId)

## Why

v1 通过 config/app.yaml + shared/config/models.py (~1090 行) 管理模型配置和 provider 选择。v2 用 AI SDK 的 @ai-sdk/* provider 包 → 声明式配置 + 前端管理界面。

## What Changes

- **NEW** `server/src/features/models/` — 模型 CRUD + provider 列表
- **NEW** `server/src/ai/provider-registry.ts` — provider 注册表 (openai/anthropic/google/deepseek)
- **MODIFIED** `config/app.yaml` — 模型 + provider 配置段

## Capabilities

- config-and-models

## Impact

- 前端模型选择器通过 /v2/models 获取可用模型列表
- Provider 通过 @ai-sdk/* 包声明，apiKey 从 config/secret.env 读取
- 砍掉 v1 endpoint_candidates/ollama_discovery ~500 行胶水
