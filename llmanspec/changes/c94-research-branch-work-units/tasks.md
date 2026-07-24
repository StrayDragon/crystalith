# Tasks: c94-research-branch-work-units

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-runtime` r327 + scenarios
- [x] `llman sdd validate c94-research-branch-work-units --strict --no-interactive`

## Apply（`llman-sdd-apply` · 全程 main）

### 1. 调度扩展

- 1.1 `researchNodesNeedingWork` / drain 覆盖 c93 拆解的全部活 research 节点
- 1.2 单元前后 `phase` graph_patch + progress 事件

### 2. runLoop / resume

- 2.1 question 写回后 drain；confirm resume 后再次 drain
- 2.2 预算耗尽与 pruned 跳过路径

### 3. 测试

- 3.1 多支路 Run：每节点 evidence 写回且 merge 边保留
- 3.2 prune 中途一支：其余节点仍完成
- 3.3 M1 budget gate 仍触发（回归）

### 4. 验证

- 4.1 `just test` research 子集
- 4.2 `llman sdd validate c94-research-branch-work-units --strict --no-interactive`
