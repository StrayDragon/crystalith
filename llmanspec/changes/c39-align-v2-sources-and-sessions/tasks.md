# align-v2-sources-and-sessions — Tasks

## 1. 竞态修复 (P0)

- [ ] `features/sources/source-extras.router.ts`: QA-to-source — embedding 失败时不设 ready（移除无条件 ready 覆盖）
- [ ] `features/sessions/router.ts`: convert-to-source — 同上修复

## 2. dedup 默认对齐

- [ ] `features/sources/router.ts`: dedup_action 默认从 create_new 改为 prompt（upload + from-url 两处）

## 3. tag 校验

- [ ] `features/sources/router.ts`: create tag — 唯一性检查（case-insensitive）+ normalize/trim/max64
- [ ] `features/sources/router.ts`: update tag — 唯一性 409 + notebook 归属校验
- [ ] `features/sources/router.ts`: delete tag — notebook 归属校验
- [ ] `features/sources/router.ts`: assign tag — source 存在 + 幂等（已 assigned 返回提示）
- [ ] `features/sources/router.ts`: remove tag — source 存在 + 幂等

## 4. per-source QA 向量检索

- [ ] `features/sources/source-extras.router.ts`: per-source QA — embed question + scoped vector search（topK=5, minScore=0.1），无命中才 fallback 取前 N

## 5. from-url link 模式

- [ ] `features/sources/router.ts`: from-url — mode=link 时不 fetch，创建轻量 source（URL+title+snippet 单 chunk）

## 6. SSRF fallback 修复

- [ ] `features/sources/router.ts`: from-url fallback fetch 包在 validateUrlForFetch guard 内

## 7. list sources 过滤/排序

- [ ] `features/sources/router.ts`: list — 支持 tag 过滤 + sort_by(date|name|size|type) + sort_order
- [ ] `features/sources/router.ts`: 修复 N+1 查询（批量查 tags 而非逐 source）

## 8. sessions 补全

- [ ] `features/sessions/router.ts`: 新增 GET /v2/notebooks/:nid/sessions/:sid（单个 session）
- [ ] `features/sessions/router.ts`: PATCH/DELETE/convert — 校验 session.notebookId == nid
- [ ] `features/sessions/router.ts`: convert 端点 set.status = 201
- [ ] `features/sessions/router.ts`: convert-to-output — 从 citations 收集 chunk_ids 附加到 output

## Verification

```bash
cd apps/server && bun test features/sources
cd apps/server && bun test features/sessions
# 竞态测试：embedding 失败 → source 状态为 failed 非 ready
# tag 唯一性测试：重复名 → 409
# per-source QA 向量检索测试
# from-url link 模式测试（不 fetch）
# sessions GET 单个 + 归属校验测试
```
