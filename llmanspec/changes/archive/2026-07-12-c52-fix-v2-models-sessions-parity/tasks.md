# fix-v2-models-sessions-parity — Tasks

## 1. models list envelope 补 providers (P1)

- [x] `features/models/router.ts`: list envelope 补 `providers`（sorted {openai} ∪ knownProviders()，对齐 v1 api.py:95-97）
- [x] 保留 `/models/providers` 端点（兼容）

## 2. models provider 可用性过滤 (P1)

- [x] `features/models/router.ts` list: 按 isKnownProvider(m.provider) 过滤（对齐 v1 api.py:83）
- [x] single: 未配置 provider 时 404（对齐 v1 api.py:109-110）
- [x] import isKnownProvider from ai/providers.ts

## 3. models default 形状对齐 (P1)

- [x] `features/models/router.ts`: 移除 per-model is_default_chat/is_default_embedding
- [x] list envelope 放 default_chat/default_embedding（对齐 v1 api.py:42-43,96-97）
- [x] single: 不返回 default 信息（对齐 v1 get_model 返回裸 ModelRead）

## 4. sessions convert message_ids 过滤 (P1)

- [x] `features/sessions/router.ts` convert-to-source: 加 message_ids 入参，按 id 过滤，缺失 id → 404（对齐 v1 api.py:257-268）
- [x] convert-to-output: 同上（对齐 v1 api.py:417-428）

## 5. sessions convert 文本格式对齐 (P1)

- [x] `features/sessions/router.ts` convert-to-source: 中文角色 `**助手**`/`**用户**` + `\n\n`（对齐 v1 api.py:110-123）
- [x] convert-to-output: raw 文本无前缀（对齐 v1 text_format=raw, api.py:438）

## Verification

```bash
cd apps/server && bun typecheck   # ✅ pass
cd apps/server && bun test        # ✅ 209 pass / 2 fail（research 网络 + URL 超时，非回归，与基线一致）
```

人工：
- GET /models envelope 含 providers + default_chat/default_embedding；无 per-model default 标记
- 未配置 provider 的 model 不出现 / single 404
- convert 传 message_ids 仅转换指定消息；缺失 id → 404
- convert 文本格式与 v1 一致（source 中文标签；output raw）
