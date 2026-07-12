---
depends_on: []
batch: all
---

# c52-fix-v2-models-sessions-parity — Models providers envelope + provider 过滤 + sessions message_ids + convert 文本格式

## Why

2026-07-12 第四轮深度复核发现 models 与 sessions 域存在 **5 个 P1**（c39 GET 单个已补，但 envelope 形状、provider 过滤、message_ids、文本格式多处偏离 v1）。

### Models 域

**P1-1 — providers envelope 字段缺失**

- v1 (`api.py:42-43,95-97`): list 响应 envelope 含 `providers` 字段（`sorted({"openai"} ∪ plugins.list_ai_providers())`）。
- v2 (`router.ts:43-56`): envelope 缺 `providers`；只在单独 `/models/providers` 端点（router.ts:69-71）暴露。前端读 `resp.providers` 会 break。

**P1-2 — provider 可用性过滤缺失**

- v1 (`api.py:83,109-110`): list 与 single 都按 `plugins.is_provider_available(m.provider)` 过滤；未配置 provider 的 model 不出现，single 返回 404。
- v2 (`router.ts:38-42`, `shared/config.ts:213-215`): list 只按 role 过滤；getModelById 做裸 `find(id)` 无 provider 检查。未配置 provider 的 model 仍出现。

**P1-3 — default 形状：per-model 内联 vs envelope 顶层**

- v1: list envelope 有 `default_chat`/`default_embedding`（api.py:42-43,96-97）；single 返回裸 ModelRead（无 default 信息，api.py:101）。
- v2 (`router.ts:53-54,65-66`): 给每个 model 挂 `is_default_chat`/`is_default_embedding`；single 也内联默认标记。与 v1 契约不一致。

### Sessions 域

**P1-4 — convert 不支持 message_ids 过滤**

- v1 (`api.py:34-41,51-57,257-268,417-428`): convert-to-source 与 convert-to-output 都接受 `message_ids`，仅转换指定消息，缺失 id → 404。
- v2 (`router.ts:185,298`): convert-to-source 无 body schema（总转换所有消息）；convert-to-output 只读 `output_type`。多轮历史无法选择性转换。

**P1-5 — convert 文本格式偏离**

- v1 convert-to-source (`api.py:110-123`): 中文角色 `**用户**:`/`**助手**:` + `\n\n`。
- v2 (`router.ts:203-208`): 英文 `**Assistant**:`/`**User**:` + `\n\n---\n\n`。
- v1 convert-to-output (`api.py:438`): `text_format="raw"`（无角色前缀）。
- v2 (`router.ts:314-319`): 加 `[Assistant]`/`[User]` 前缀。跨版本导出 diff 噪音。

## What Changes

1. **models list envelope**: 补 `providers` 字段（与 v1 一致）；保留 `/models/providers` 端点（兼容）。
2. **models provider 过滤**: list 与 single 按 provider 可用性过滤；未配置的 model 不出现 / single 404。
3. **models default 形状**: list envelope 放 `default_chat`/`default_embedding`；移除 per-model 内联默认标记；single 不返回 default 信息。
4. **sessions convert message_ids**: convert-to-source 与 convert-to-output 接受 `message_ids` 过滤；缺失 id → 404。
5. **sessions convert 文本格式**: source 用中文角色标签 + `\n\n`；output 用 raw（无前缀）。

## Capabilities

- `workspace-api-contract`（spec delta: models providers envelope + provider 过滤 + default 形状 + sessions message_ids + convert 文本格式）

## Impact

- **前端 models 可用**: providers 字段不再缺；default 标记位置与 v1 一致。
- **models 过滤正确**: 未配置 provider 的 model 不暴露。
- **sessions convert 灵活**: 支持选择性转换多轮历史。
- **convert 文本跨版本一致**: diff 无噪音。
- **无 BREAKING**: 端点路径不变；default 标记从 per-model 移到 envelope 是契约收敛（v1 是 SSOT）；message_ids 为可选参数。
