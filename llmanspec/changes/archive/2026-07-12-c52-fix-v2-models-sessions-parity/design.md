# c52-fix-v2-models-sessions-parity — Design

## 关键决策

### D1: models providers envelope + default 形状

list 响应 envelope 补 `providers` 字段（sorted，对齐 v1 `api.py:95-97`），保留 `/models/providers` 端点兼容。default_chat/default_embedding 移到 envelope 顶层（对齐 v1），移除 per-model 的 is_default_chat/is_default_embedding。GET single 不返回 default 信息（对齐 v1 get_model）。

**BREAKING（收敛）**: per-model default 标记 → envelope 顶层。v1 是 SSOT，前端需调整读取位置。

### D2: provider 可用性过滤

新增 `isProviderAvailable(provider)` helper（检查 `ai/providers` 注册 + config 配置）。list 与 single 都用它过滤；未配置 provider 的 model 不出现 / single 404。

### D3: sessions convert message_ids

convert-to-source 加 request body schema（{message_ids?: number[]}）；convert-to-output body 补 message_ids。两者都按 id 过滤消息，缺失 id → 404（对齐 v1）。message_ids 可选（省略=全部）。

### D4: convert 文本格式

- convert-to-source：中文角色 `**用户**:`/`**助手**:` + `\n\n`（对齐 v1）。
- convert-to-output：raw 文本无前缀（对齐 v1 text_format=raw）。

## 迁移与回滚

- 无 DB schema 变更；default 标记位置变更是契约收敛。
- message_ids 为可选参数，向后兼容。
- 回滚 = git revert。
