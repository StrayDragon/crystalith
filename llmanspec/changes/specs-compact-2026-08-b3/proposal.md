---
depends_on: []
rules_edit_acked: true
---

# Proposal — specs-compact-2026-08-b3

## Why

b1/b2 完成了正确性修复、守则违规清理与首批冗余合并后，spec 语料仍有一类系统性膨胀：
toon2features 迁移把 v1 验收场景机械展开为「`- 必须成立：…` 摘要 bullet + 逐字重复一遍
假如/当/那么」的双写场景（950 个场景中 542 个，57%），其中约 85% 与同 requirement 的描述性
场景语义完全等价。此外仍有 13 组跨 capability 残余重叠（G1–G13，其中 G1/G2 为 b1 design D7
点名但两轮均未执行），以及若干守则违规残留（魔法数字、语气冲突）。

本变更同时落地 @executable 转换的第一批（标签先行）：把 HTTP 可测、且与既有 BDD 步骤词汇
匹配的场景改写为 `@req:<id> @executable` 验收场景（使用 `apps/server/tests/bdd/steps/common.ts`
的真实步骤措辞），使 llman 侧 enforced 状态成立；runner 扫描 specs 的执行闭环另立 change。

## What Changes

- **Pattern A（1:1 镜像删除）**：删除与同 requirement 描述性场景完全等价的机械场景；
  机械场景含增量语义（错误码/端点/负面用例）时，将该子句并入保留场景正文。
- **Pattern B（1:N 分解收敛）**：一个稠密段落被拆成 2–4 个机械场景的，纯重述删除，
  有可观察行为增量的去噪后保留（预计全仓保留约 60–80 个此类实例）。
- **双写去噪**：所有保留场景统一为单一陈述形态（描述性 bullet 或 Gherkin 三段式，二选一），
  删除 `- 必须成立：…` 后逐字重复的行。
- **跨 capability 引用化**：G1–G13 按 design.md D2 处置表执行（canonical 归属 + 引用语）。
- **守则违规顺手修复**：魔法数字（sqlitevec-topk-latency p50<10ms、r183 默认 10min 等）
  归 config 表述；architecture-plugin-and-agent r118 的 DEFERRED/MAY vs SHALL 语气冲突消解。
- **r268 漂移裁决**：删除「batch delete MUST 使用 DELETE 方法」子句，对齐实现现状
  （`POST /v2/notebooks/:nid/sources/batch/delete`）；保留逐项结果数组 + epoch 语义。
- **@executable 第一批（标签先行）**：约 12–18 个场景转为 `@executable` 验收场景，
  覆盖 source-ingestion-management-and-tags、workspace-api-contract 错误/分页语义、
  workspace-command-registry 三个域；步骤措辞与 common.ts 词汇表一致，便于后续 runner 接线。
- **不改变任何规范行为**（除 r268 方法子句按上述裁决对齐实现现状）。

## BREAKING

无 wire/代码改动。规范文本层面仅 r268 删除方法子句（对齐已验证的实现现状）。

## Non-Goals

- runner 扫描 `llmanspec/specs` + `onlyTags` 过滤的执行闭环（另立 change）
- SSE/config 注入/出站网络 mock 类场景的可执行化（需独立基建）
- requirement 级大规模删除合并（本轮以 scenario 级压缩为主，requirement 标题保持稳定）

## Verification

- `llman sdd validate --specs --strict --no-interactive` 全绿
- 场景计数台账：950 → 目标 ≈485（允许 ±25 区间，逐 capability 台账见 tasks.md）
- 每个 requirement 至少保留 1 个有效 scenario
- req_id 全局唯一性不破坏（grep 抽查被删 req_id 无跨 spec 引用残留）
- `just test-bdd` 不受影响（runner 未改）
