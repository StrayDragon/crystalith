# Tasks: c100-lab-eden-e2e-production-path

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r453 + scenarios
- [x] `llman sdd validate c100-lab-eden-e2e-production-path --strict --no-interactive`

## Apply（`llman-sdd-apply` · 全程 main）

### 1. Harness 与环境

- 1.1 确认 e2e 启动 web 时 `VITE_LAB_FIXTURE` 未设（或文档化 override）
- 1.2 测试 server：mock LLM / 加速 confirm 的配置（复用既有 research e2e 基建）
- 1.3 补齐缺失 testid（Compose、confirm 条、convert、report）

### 2. @p0 Eden 全路径

- 2.1 Playwright：Compose 填主题 → start → 等待 `research-lab-graph` 含节点与边
- 2.2 等待/触发 `awaiting_confirm` → 执行 continue 或 finish_report（或 expand_branch 路径）
- 2.3 打开报告页 → 断言 report 内容加载
- 2.4 convert → 成功 toast（含 c91 action 可选断言）
- 2.5 标记 `@p0`；`just e2e` 可筛选通过

### 3. 门禁纪律

- 3.1 区分 fixture-only spec：不得作为唯一 `@p0` 深研门禁
- 3.2 README / e2e 注释：生产 parity 定义

### 4. 验证

- 4.1 `just e2e`（或 `bun run e2e -- --grep @p0`）本地绿
- 4.2 `just qa` 全绿
- 4.3 `llman sdd validate c100-lab-eden-e2e-production-path --strict --no-interactive`
