---
depends_on: [c92-lab-compose-depth-tier]
---

## Why

c78 内核已种子单结论 DAG（question + conclusion）并串行执行 question work-unit，但 **未**将主题自动拆解为多研究支路。Lab fixture `xlsx-lib` 已演示 decompose/refine/merge 拓扑与多节点探索，而 Eden Run 仍近线性，产品与演示机制脱节。需在 seed 之后由服务端 **结构化 LLM 规划**自动建图，且受 depth→maxNodes 预算约束。

## What Changes

1. **Topic decompose planner**：seed 单 sink 后，内核 MUST 调用结构化规划，将主题拆为 `role=research` 节点；自 question 发出 `decompose`/`refine` 边，各活研究节点 MUST 以 `merge` 汇入唯一 conclusion。
2. **Depth-gated 预算**：节点数 MUST 受 Run `maxNodes`（由 create `depth`→r305）限制；超预算时 MUST 裁剪或拒绝扩展，不得静默越界。
3. **graph_patch 权威**：规划结果 ONLY 经内核 `persistGraph` + `emitGraphPatch` 写入；LLM MUST NOT 直接 mutate 图。
4. **失败回退**：规划失败或输出非法时 MUST 回退为 **仅 question work-unit** 路径，MUST NOT 伪造多支路拓扑。
5. **进度账本**：拆解与建边 MUST `appendProgressEvent`（如 `graph_patched_summary`），MUST NOT 用前端 timer/phase 作为拓扑 SSOT。
6. **测试**：server research 单测 + 与 `fake/scenarios.ts` xlsx-lib 拓扑形状对照清单（见 design.md）。

## Capabilities

- `deep-research-runtime` — r326 主题自动拆解内核

## Impact

- depends_on `c92-lab-compose-depth-tier`（create 传 depth→预算）
- **BDD-off**；design.md 锁定 planner 形状与 fixture 对照
- **Apply**：**全程 main**
- **Fixture xlsx-lib** 保留至 c100 作 UX 参照；Eden 为产品默认权威
- **LLM structured auto-decompose**；边种类对齐 fixture：`decompose` / `refine` / `merge`（`support` MAY）
- **M1 confirms 保留**；本变更不删 budget/expand_branch 门
- **进度**：来自 progress ledger / SSE，非 FE timer
- **MUST NOT defer further**：本变更是 c94 分支 work-unit 的前置，不得再推迟

## Seams

- `apps/server/src/features/research/service.ts` — `runLoop` seed 后插入 planner；`emitGraphPatch`
- 新模块或 `node-agent` / planner — 结构化 `generateObject` 输出
- `packages/shared/src/schemas/research.ts` — planner 输出 Zod（若需同形合约）
- `appendProgressEvent` / progress SSE
- 不含：Lab UI 变更（c95）；分支调度扩展（c94）
