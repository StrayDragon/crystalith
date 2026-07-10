---
depends_on: [c24-add-v2-pipeline-integration]
batch: all
---

# c39-align-v2-sources-and-sessions — Sources + Sessions v1 行为对齐

## Why

c30 (sync-embedding) 标 DONE，但 2026-07-10 对拍发现 ready-before-vectors 竞态在 QA-to-source 和 sessions convert-to-source 两条路径**复发**。同时 sources 的 dedup/tags/校验存在系统性偏离：

### 竞态复发 [P0]

- **QA-to-source** (`sources/source-extras.router.ts:246-251`): catch 设 failed 后**无条件**又设 ready — embedding 失败的 source 被标 ready（c30 修的 bug 在这条路径上又出现）
- **sessions convert-to-source** (`sessions/router.ts:249-256`): 同样的 failed→ready 无条件覆盖

### Sources 偏离 [P0/P1]

- **dedup 默认关闭** [P0]: v2 默认 `create_new`（禁用去重），v1 默认 `prompt`。v2 也无 dedup.enabled config gate。
- **tag 端点全无校验** [P1]: v1 有唯一性 409 + notebook 归属校验 + 幂等性。v2 无任何校验（重复 assign 插入重复行）。
- **per-source QA 不用向量检索** [P1]: v1 embed question + vector search scoped to source。v2 取前 15 chunk。
- **from-url 丢弃 link 模式** [P0]: v1 link 模式 = 轻量 source（不 fetch）。v2 总是 fetch。
- **SSRF 旁路** [P0]: from-url 的 fallback fetch (`router.ts:495`) 不经 validateUrlForFetch。
- **list sources 缺过滤/排序** [P1]: v1 有 tag 过滤 + sort_by + 缓存。v2 固定 updatedAt desc + N+1 查询。

### Sessions 偏离 [P1/P2]

- **缺 GET 单个 session** [P1]: v1 有 `GET /{session_id}`。v2 无。
- **notebook 归属不校验** [P1]: v1 校验 session.notebook_id == notebook_id。v2 忽略。
- **convert 端点不设 201** [P2]
- **convert-to-output 缺 citation→chunk_ids** [P2]: v1 从 citations 收集 chunk_ids。v2 不读 citations。

## What Changes

1. **修复 2 处竞态**: source-extras + sessions convert-to-source 的 failed→ready 无条件覆盖 → 改为 embedding 成功才设 ready
2. **dedup 默认改 prompt**: 对齐 v1 默认行为
3. **tag 端点补校验**: 唯一性 409 + notebook 归属 + 幂等性
4. **per-source QA 用向量检索**: embed question + scoped vector search（非取前 N chunk）
5. **from-url 补 link 模式**: mode=link 时不 fetch，创建轻量 source
6. **SSRF fallback 修复**: fallback fetch 也走 validateUrlForFetch
7. **list sources 补 tag 过滤 + sort_by**
8. **sessions 补 GET 单个 + notebook 归属校验 + convert 201 + citation→chunk_ids**

## Capabilities

- source-ingestion-management-and-tags (spec delta: tag 校验 + list 过滤)
- source-ingestion-summary-and-conversion (spec delta: per-source QA 向量检索 + convert 竞态修复)
- cross-type-result-transformations (spec delta: session convert 行为对齐)

## Impact

- 2 处竞态修复（数据正确性）
- dedup 默认行为改变（create_new → prompt）
- tag 端点新增 409 错误（重复名）
- from-url 新增 link 模式分支
