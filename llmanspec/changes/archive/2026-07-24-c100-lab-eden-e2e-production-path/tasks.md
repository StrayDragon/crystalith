# Tasks: c100-lab-eden-e2e-production-path

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r453 + scenarios
- [x] change artifacts validate (`--strict --no-interactive`)

## Apply（`llman-sdd-apply` · 全程 main）

### 1. Harness 与环境

- [x] 1.1 e2e web `VITE_LAB_FIXTURE` 清空；文档化
- [x] 1.2 `CL_RESEARCH_E2E_STUB` + mock OpenAI gateway（L1 A+B）
- [x] 1.3 convert / confirm testid 补齐

### 2. @p0 Eden 全路径

- [x] 2.1 Compose → graph nodes+edges
- [x] 2.2 budget continue + expand_branch approve（L3=C）
- [x] 2.3 报告页加载
- [x] 2.4 convert note + source（L4=A+B）
- [x] 2.5 `@p0`；`just e2e` 可筛选

### 3. 门禁纪律

- [x] 3.1 fixture smoke 非唯一 parity
- [x] 3.2 e2e AGENTS / design 注明生产 parity

### 4. 验证

- [x] 4.1 `just e2e`（@p0）本地绿
- [x] 4.2 `bun typecheck` + 相关 server unit
- [x] 4.3 change validate (`--strict --no-interactive`)
