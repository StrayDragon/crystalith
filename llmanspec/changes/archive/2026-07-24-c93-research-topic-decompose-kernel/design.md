# Design: c93 Research topic decompose kernel

> **状态**：规划锁定 · Apply 全程 **main**（archive+commit 后才开下一条）
> **参照**：`apps/web/src/features/research-lab/fake/scenarios.ts` `xlsx-lib` 拓扑（非权威，parity checklist）

## 1. 插入点（runLoop）

```text
seedSingleSinkGraph (question + conclusion)
  → planTopicDecomposition(run)   # 本变更
  → [fallback] question-only work path if plan fails
  → (c94) drainResearchWorkUnits over research nodes
  → M1 budget confirm / synthesize (unchanged)
```

- 规划在 **首次** question work-unit 之前执行（或紧接 seed 后），使后续单元面对完整支路图。
- 任何写图 MUST `persistGraph` + `emitGraphPatch` + checkpoint（CP1 语义不变）。

## 2. Planner 输出形状（结构化 LLM）

使用 AI SDK `generateObject` + shared Zod `ResearchDecomposePlanSchema`。

**模型（E1 锁定）**：支持配置 `research.decomposeModelId`；**省略/空字符串时继承 `models.defaults.chat`**（`getResearchDecomposeModelConfig`）。

```ts
// 概念形状 — 实现时落 packages/shared 或 server 局部（不得与路由合约同名异形）
{
  branches: Array<{
    id: string; // 客户端稳定 id 前缀，服务端可规范化
    title: string;
    query: string;
    parentId: 'question'; // 首期仅从 question decompose
    edgeKind: 'decompose' | 'refine';
  }>;
  merges: Array<{
    branchId: string;
    // 目标固定为唯一 conclusion id
  }>;
}
```

规则：

| 规则      | 说明                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| 节点 role | 新增节点 MUST `role=research`                                                                                            |
| 边 kind   | question→branch 用 `decompose`（首期）；branch 间 `refine`/`support` 可选；branch→conclusion MUST `merge`                |
| 预算      | `branches.length` + 既有节点数 MUST ≤ `run.maxNodes`；裁剪策略：优先保留 decompose 直连支路，按 planner 置信或字典序截断 |
| 保护      | MUST NOT 创建第二 conclusion；MUST NOT prune/merge 保护节点                                                              |
| 写入口    | 仅 `applyDecomposePlan(runId, plan)` 内核函数可批量 upsert nodes/edges                                                   |

## 3. Depth → node budget（r305）

| depth   | maxNodes | 规划建议上限（含 question+conclusion） |
| ------- | -------- | -------------------------------------- |
| shallow | 12       | ≤4 research 叶节点                     |
| medium  | 30       | ≤8 research                            |
| deep    | 60       | ≤16 research                           |

Planner prompt MUST 注入 `maxNodes` 与已占用节点数；超限输出由服务端截断并记 `appendProgressEvent`。

## 4. 失败回退

| 条件                                  | 行为                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------- |
| LLM 超时/解析失败                     | 记录 log + progress；**不**添加 research 节点；继续 question-only work-unit |
| 非法边（指向缺失节点、双 conclusion） | 丢弃整包计划，同回退                                                        |
| 空 branches                           | 合法 no-op；视为回退                                                        |

MUST NOT：写入部分非法支路后假装多分支成功。

## 5. Progress / SSE

- 成功：`graph_patched_summary` + log「已拆解 N 个研究支路」
- 回退：`unit_skipped` 或等价 + log「拆解失败，改走单路径」
- FE Lab phase timer **不得**作为拓扑来源（r326）

## 6. Fixture parity checklist（xlsx-lib）

对照 `scenarios.ts` xlsx-lib，Eden Run 在成功规划后 SHOULD 满足：

- [ ] 1 question + 1 conclusion
- [ ] ≥2 research 节点自 question `decompose` 出发
- [ ] 每个活 research 节点至少一条 `merge`→conclusion
- [ ] 允许 `refine` 链（如 n-libs→n-stream）当预算允许
- [ ] pruned 节点不参与规划（discarded-if-pruned 仍适用）

不要求标题/查询字面与 fixture 一致；要求 **边种类与单 sink** 语义一致。

## 7. 红线

1. Tool `execute` 内直接 `persistGraph`
2. 客户端上传拆解结果
3. 用 `LabPhase.decompose` 定时器驱动服务端建图
4. 规划失败仍 emit 假多节点 graph_patch
