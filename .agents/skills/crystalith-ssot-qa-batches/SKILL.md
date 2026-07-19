---
name: crystalith-ssot-qa-batches
description: >
  Crystalith post-migration SSOT / QA convergence playbook: Eden≠Zod, batch
  discipline (just qa → commit), product-gap lock-tests vs stale specs, orphan
  vision specs, and low-risk god-file splits. Use when continuing Crystalith
  architecture cleanup, Zod/Eden SSOT work, spec-code drift hygiene, or phased
  QA waves after a stack rewrite. Invoke via /crystalith-ssot-qa-batches.
---

# Crystalith SSOT / QA Batch Playbook

提炼自 2026-07 阶段性 QA 收敛（`_PROGRESS.md` Wave A–G）。**先出结果，再写 skill**；本文件是可复用的作业法，不是元流程说明书。

## When to use

- 迁移后合约漂移、平行 DTO、假缺口 specs、门禁假绿
- 需要小步收敛且**不一定开 llman SDD**（行为合约未变）
- 产品 gap「看起来缺」但代码可能已落地（c4x 遗留）

## Non-goals（本 playbook 默认）

- 不做分发 / Tauri / single-binary（c13 类）除非用户点名
- 不为「清理」强行开 SDD change；改 MUST/SHALL 合约时才切 `/llman-sdd-*`
- 不追求 API 零 Zod

## Core model: Eden ≠ Zod

```text
shared Zod → Elysia 运行时校验 + App 类型
          → Eden treaty<App>（编译期管道，不做 resp 再解析）
          → OpenAPI 由同一份 Zod 衍生
```

| 误解 | 正解 |
|------|------|
| Eden 可替代 Zod | **否**。Eden 无运行时校验 |
| Zod 与 Eden 二选一 | **否**。冗余来自**平行 DTO**，不是并存本身 |

**席位**：

| 层 | 做 | 不做 |
|----|----|------|
| `packages/shared` Zod | HTTP/跨端 SSOT；`.describe(desc)`；宜 `.openapi()` | 纯 UI 状态 |
| server 路由 | 挂 shared Zod | 平行 `z.object`；Elysia `t.*` |
| web | Eden 推断；标称类型可从 shared | `shared-types` / workspace wire DTO 再造 |
| config yaml/env | 必留 Zod | 把 HTTP 合约塞进 config |

## Batch discipline（硬）

1. 切合理小批（一波一个主题）
2. 实现 / 锁测 / 清假缺口
3. **`just qa` 必须绿**（typecheck + lint + format + drift + unit + web vitest + e2e `@p0`）
4. **再 commit**（`feat:` / `fix:` / `test:` / `refactor:` / `doc:` / `misc:`）
5. 有问题随时停并报告；不攒大批

## Typical wave shapes

### A — Schema / storage SSOT

例：裸 `CREATE TABLE` → Drizzle schema + migration；去掉 boot 旁路建表。

### B — Wire / OpenAPI 对齐

例：`OutputContentByType` 进 shared；路由挂 response Zod；`frontendBundle` 发射。

### C — `.openapi()` 批量

shared 启用 zod-extend；高频 schema 补注解；其余可增量。

### D — 「产品 gap」

**先读代码**。多数「当前 v2 未实现」是 **假缺口**：

1. 确认实现已在（常标 c4x 注释）
2. 补回归测锁行为
3. 手改 toon：去掉过时「缺…」措辞；真未做的标 DEFERRED 或删除愿景
4. 仅真缺口才写新逻辑；修小 bug 可同波（例：`needsRepair` 误判）

### E — 孤儿愿景 specs

无代码 SSOT 的 capability：默认 **删除**（或用户明确要求归档）。  
混有已落地条款的：精简为已实现 req，删愿景状态机条款。  
`llman sdd validate --specs --strict` 验收。

### F — 神文件拆分（行为不变）

优先**清晰缝**：

- 已内联的子组件 → `components/`
- 已有 section banner + 单测的纯函数块 → 旁路模块（如 `postprocess.ts` / `citations.ts`）

避免：prop hub 编排壳、高耦合 agent 循环、需先 redesign store 的面板。  
拆完跑相关单测 + `just qa`。

### G — 收尾

从进度台账提炼本 skill；台账可删或归档。可选 push。

## Spec hygiene rules

- 代码是 SSOT；specs 跟代码，不反向编造愿景验收
- 手改 toon **≠** 开 SDD change（本 playbook 默认）
- compact / validate 用现有 llman 工具；不把 BDD / type-aware 塞进 `just qa` 除非明确扩门禁

## Gate notes（Crystalith）

- 权威门禁：`just qa`
- Tier 0 业务代码：lint error/warn 与 test 失败必须修，禁止靠全局 override 蒙混
- 格式：`bunx oxfmt`（根 `bun format` 可能只是 `--check`）

## Stop conditions

- `just qa` 红且无法在本波合理修复 → 停、报告、不要硬 commit
- 发现需改 MUST/SHALL → 切换 `/llman-sdd-propose` 完整路径
- 用户点名 c13 / 分发 → 离开本 playbook

## Checklist（每波）

- [ ] 主题单一，范围可一句话说清
- [ ] 假缺口 vs 真缺口已区分
- [ ] 有回归测或 validate 证据
- [ ] `just qa` 绿
- [ ] commit 信息写清 why
- [ ] 进度台账勾选更新（若仍使用）
