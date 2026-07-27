# Tasks: c108-research-budget-commitment

## Propose（本阶段）

- [x] proposal + design + seams 确认
- [x] live specs（runtime + ui）+ attach Full + validate
- [x] blocked-by: c107 Full 提案完成（depends_on；本分支基于 c107 tip）

## Apply（后续 `llman-sdd-apply`；建议 c107 apply 后）

### 1. 数字 + config

- [x] 1.1 `RESEARCH_DEPTH_BUDGETS` 20/50/100 · 24/60/120
- [x] 1.2 `addOnRatio` / `addOnMinK` / `addOnMaxK` + schema gen

### 2. 加购命令口

- [x] 2.1 budget `continue` = +K 并 resume（非假继续结案）
- [x] 2.2 `add-budget`（或等价）常驻/主动加购
- [x] 2.3 不抬 maxNodes；agent propose 接线

### 3. Kernel

- [x] 3.1 删除波次剩余 / max-1 自动 budget confirm
- [x] 3.2 仅真触顶 enterConfirm(budget)
- [x] 3.3 每单元 searchSoft 均分；指令写入剩余预算

### 4. 报告 + UI

- [x] 4.1 部分完成诚实文案（报告 + Lab）
- [x] 4.2 常驻「增加检索预算」；budget confirm 文案对齐加购

### 5. 测试

- [x] 5.1 默认 medium 新数字；加购公式；确认时机；软上限
- [x] 5.2 research suite + Lab Vitest 相关全绿

### 6. 验证

- [x] 6.1 `just qa` 相关子集 + `llman sdd validate c108-… --strict`
