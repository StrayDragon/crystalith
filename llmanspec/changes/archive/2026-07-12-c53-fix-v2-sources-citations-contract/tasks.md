# fix-v2-sources-citations-contract — Tasks

## 1. qa-to-source 多轮 messages (P1)

- [x] `features/sources/source-extras.router.ts`: 接受 `messages: Array<{role,content}>` 多轮历史（对齐 v1 api_qa.py:186-209）；格式化为中文角色 transcript（**助手**/**用户**）
- [x] 保留单轮 {question, answer} 向后兼容（messages 优先，无则要求 question+answer）

## 2. tag 绑定 per-item 诊断 (P1)

- [x] `features/sources/router.ts` assign/remove: 返回 `results[]`（per-item {source_id, ok, message?, error_code?}，对齐 v1 api_tags.py:180-184）
- [x] 缺失 source 报 SOURCE_NOT_FOUND（非静默 continue）
- [x] 保留 {applied, skipped} 计数兼容

## 3. CSV parser 转义 (P1)

- [x] `features/sources/parsers/csv.ts`: 新增 `escapeCell`（|→\|、换行→空格，对齐 v1 csv.py:61-67）
- [x] `truncateCell` 截断用 `…` 省略号（非 `...`）
- [x] 新增 `formatCell`（escape + truncate 按序）；rowsToMarkdownTable 用 formatCell

## 4. citations /context 路径修正 (P1, BREAKING)

- [x] `features/citations/router.ts`: 路径改 `/notebooks/:nid/citations/context`（对齐 v1 api.py:13 与 c26 proposal/design 承诺）；notebook_id 从 query param 改为 path param
- [x] 更新 `test/citations/context.test.ts` 调用路径（ctxPath helper）

## 5. citations 默认 before/after=1 (P1)

- [x] `features/citations/router.ts`: before/after 默认 1（对齐 v1 api.py:61-62 Query(1, ge=0, le=5)）；clamp 0-5 保留

## 6. connector config JSON-schema 校验 (P1)

- [x] `features/source-connectors/router.ts`: 新增 `validateConnectionConfig`（检查 required + 非空 string + additionalProperties:false）
- [x] create binding 时校验 connection_config，非法 → 400 INVALID_CONFIG（对齐 v1 api.py:77-98,199-200）

## Verification

```bash
cd apps/server && bun typecheck   # ✅ pass
cd apps/server && bun test        # ✅ 208 pass / 2 fail（research 网络 + URL 超时，非回归）
cd apps/server && bun test test/citations/  # ✅ 12 pass / 0 fail
```

人工：
- qa-to-source 多轮可转换；单轮仍兼容
- tag 批量绑定 results 含 per-item 诊断；缺失 source 报 SOURCE_NOT_FOUND
- CSV 含 `|`/换行正确转义；截断用 `…`
- citations /context 走 `/notebooks/:nid/` 层级路径；默认 1/1
- connector 畸形 config → 400 INVALID_CONFIG
