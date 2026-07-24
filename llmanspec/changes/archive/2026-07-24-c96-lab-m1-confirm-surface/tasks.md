# Tasks: c96-lab-m1-confirm-surface

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r449 + scenarios
- [x] validate change (strict, no-interactive)

## Apply（`llman-sdd-apply` · 全程 main）

### Locked（2026-07-24）

- H1=A：扩展顶栏主/次（+ tertiary）按钮
- H2=B：高亮 branch + 直接邻接
- H3=A：budget 仅 continue/finish；expand 才 approve/skip
- H4=B：确认错误内联（lastError 红条，不 toast）
- H5=A：Fixture 按 confirmKind 分化

### 1. confirmKind 文案与动作条

- [x] 1.1 `resolveLabPrimaryAction` budget vs expand 分化
- [x] 1.2 暴露 continue / finish / approve / skip（H3）
- [x] 1.3 Vitest 文案与按钮集合

### 2. 分支高亮

- [x] 2.1 Eden/Fixture：`confirmHighlightIds` + highlightedNodeIds
- [x] 2.2 Vitest 邻接断言

### 3. confirm API 与错误

- [x] 3.1 skip/approve → confirmResearchRun
- [x] 3.2 RESEARCH_BUDGET / INVALID_STATE 内联 lastError
- [x] 3.3 Vitest skip/approve 请求体

### 4. 验证

- [x] 4.1 ran web Vitest CI and typecheck
- [x] 4.2 ran llman sdd validate for this change
