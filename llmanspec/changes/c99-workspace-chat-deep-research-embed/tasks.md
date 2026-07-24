# Tasks: c99-workspace-chat-deep-research-embed

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r452 + scenarios
- [x] `llman sdd validate c99-workspace-chat-deep-research-embed --strict --no-interactive`

## Apply（`llman-sdd-apply` · 全程 main）

### 1. 命令注册与解析

- 1.1 workspace chat：注册深研相关 `@` / `/` 命令（创建、打开 Lab、深链 rid）
- 1.2 解析层 Vitest：合法命令 → 预期 action（navigate / create）
- 1.3 文档化支持的命令语法（web AGENTS 或内联 help）

### 2. 导航与创建

- 2.1 「打开 Lab」→ `/research-lab/:nid`（可选 `?rid=`）
- 2.2 「新建深研」→ Eden create 或带 query 打开 Compose 预填
- 2.3 「引用 Run」→ listRuns 选取或 rid 直链
- 2.4 Vitest：mock navigate / create 调用

### 3. 主入口保留

- 3.1 确认烧瓶、`researchLabEntry`、Compose 仍可达（回归 Vitest 或 e2e 既有用例）
- 3.2 chat 入口标注为辅助（无独占深研 UI）

### 4. 验证

- 4.1 `cd apps/web && bun run test:ci` + `bun typecheck`
- 4.2 `llman sdd validate c99-workspace-chat-deep-research-embed --strict --no-interactive`
