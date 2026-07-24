# Tasks: c94-research-branch-work-units

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-runtime` r327 + scenarios
- [x] `llman sdd validate c94-research-branch-work-units --strict --no-interactive`

## Apply（`llman-sdd-apply` · 全程 main）

### Locked（2026-07-24）

- F1=A：有活 research 子节点时跳过 question work-unit
- F2=B：按 `graph.nodes` **插入序**稳定排队（显式排序算法函数）
- F3=A：每单元前后 phase graph_patch
- F4=A：预算尽写回 missing 并继续（主线不强化预算回退）
- **延后**：per-node 预算；全局预算加高（另 change）

### 1. 调度

- [x] 1.1 `orderResearchNodesForWork`：插入序稳定队列 + needing 判定（避免预算跳过死循环）
- [x] 1.2 drain：单元前 `retrieving` patch；结束后 writeBack；progress 事件

### 2. runLoop

- [x] 2.1 有活 research 时跳过 question 检索，直接 drain
- [x] 2.2 无支路时保持原 question→drain 路径；confirm resume 仍 drain

### 3. 测试

- [x] 3.1 拆解后各 research 有 evidence；merge 边保留
- [x] 3.2 插入序稳定（先插入的先跑）
- [x] 3.3 无支路回归：question-only 仍完成

### 4. 验证

- [x] 4.1 `bun test ./tests/research/` + typecheck
- [x] 4.2 ran llman sdd validate for this change (strict, no-interactive)
