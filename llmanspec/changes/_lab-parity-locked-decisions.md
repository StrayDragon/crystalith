# Lab demo↔Eden 对拍 — 已锁定决策（c92–c100）

> 2026-07-24 用户确认：BDD-off；U2=每 change 独立分支；其余按推荐落地。
> **本波 MUST NOT 再延后。** Fixture `xlsx-lib`（`VITE_LAB_FIXTURE=1`）为对拍基准，**保留至 c100 门禁绿**后再议删除。

| ID         | 决议                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------- |
| 模式       | **BDD-off**（`llmanspec/config.yaml` 不加 `bdd:`）                                                 |
| U2 分支    | **全程 `main`**（不建 per-change feature 分支）；每条 change 须 **archive + commit 后** 才开下一条 |
| U3 拆解    | LLM 结构化子问题 → 内核落 `research` 节点 + 边；失败回退浅路径                                     |
| U4 深度    | 浅可不拆/少拆；中 ~3–5；深更多；均受 `maxNodes`/`maxSearches` 约束                                 |
| U5 边      | 对齐 fixture：`decompose` / `refine` / `merge` + 中文 label                                        |
| U6 fixture | 保留至 c100；产品默认仍 Eden                                                                       |
| U7 M1      | 保留 budget / expand_branch；UI 补齐 `skip_branch` + 分支高亮                                      |
| U8 相位    | c95 ledger 面板 → c97 用 progress+图状态映射（禁止 timer 权威态）                                  |
| U9 c99     | 本波保留（工作区 `@`/`/`）                                                                         |
| U10 缝     | Server unit（可 mock LLM）+ Vitest + `@p0` Playwright Eden 全路径（c100）                          |

## 顺序与依赖

```text
c92 compose depth
 → c93 topic decompose kernel
 → c94 branch work-units
 → c95 progress ledger panel
 → c96 M1 confirm surface
 → c97 phase enrichment (needs c94+c95)
 → c98 revision↔graph sync
 → c99 workspace chat embed
 → c100 Eden e2e production path
```

## Per-change locks（本会话）

| Change | Locks                                                                                                                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| c98    | **J1=A** restore 后必 GET 全量 · **J2=B** 回图 `?rid=` 强制 `loadRun` + `markLabRunNeedsReload` · **J3=A** busy+内联错误 · **J4=B** fixture 同构写 session graph · **J5=A** loadRun 再拉 progress                 |
| c99    | **K1=B** commands `kind:nav` · **K2=A** 无 topic 只开 Compose · **K3=A** 有 topic 预填不 create · **K4=slash-only** `/research-open <rid>`（无 `@`）· **K5=A** 发送吞掉 · **K6=A+C** fixture 可导航 + AGENTS 文档 |
