# fix-v2-models-sessions-parity — Tasks

## 1. models list envelope 补 providers (P1)

- [ ] `features/models/router.ts:43-56`: list 响应 envelope 补 `providers` 字段（sorted，对齐 v1 api.py:95-97）
- [ ] 保留 `/models/providers` 端点（兼容已有调用）

## 2. models provider 可用性过滤 (P1)

- [ ] `features/models/router.ts:38-42` list: 按 provider 可用性过滤（对齐 v1 api.py:83），未配置 provider 的 model 不出现
- [ ] `features/models/router.ts:59-68` + `shared/config.ts:213-215` single: 未配置 provider 时 404（对齐 v1 api.py:109-110）
- [ ] 实现一个 isProviderAvailable(provider) helper（检查 ai/providers 注册）

## 3. models default 形状对齐 (P1)

- [ ] `features/models/router.ts:53-54`: 移除 per-model 的 is_default_chat/is_default_embedding
- [ ] list envelope 放 default_chat/default_embedding（对齐 v1 api.py:42-43,96-97）
- [ ] `features/models/router.ts:65-66` single: 不返回 default 信息（对齐 v1 get_model 返回裸 ModelRead）

## 4. sessions convert message_ids 过滤 (P1)

- [ ] `features/sessions/router.ts:185` convert-to-source: 加 request body schema（{message_ids?: number[]}），按 id 过滤，缺失 id → 404（对齐 v1 api.py:34-41,257-268）
- [ ] `features/sessions/router.ts:298` convert-to-output: body 补 message_ids，过滤逻辑同上（对齐 v1 api.py:51-57,417-428）

## 5. sessions convert 文本格式对齐 (P1)

- [ ] `features/sessions/router.ts:203-208` convert-to-source: 中文角色标签 `**用户**:`/`**助手**:` + `\n\n`（对齐 v1 api.py:110-123）
- [ ] `features/sessions/router.ts:314-319` convert-to-output: raw 文本无前缀（对齐 v1 text_format=raw, api.py:438）

## Verification

```bash
cd apps/server && bun typecheck   # MUST pass
cd apps/server && bun test        # models/sessions 相关测试 MUST pass，无回归
```

人工：

- GET /models envelope 含 providers + 顶层 default_chat/default_embedding
- 未配置 provider 的 model 不出现 / single 404
- convert 传 message_ids 仅转换指定消息；缺失 id → 404
- convert 文本格式与 v1 一致
