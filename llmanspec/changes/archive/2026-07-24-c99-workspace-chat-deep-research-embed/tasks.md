# Tasks: c99-workspace-chat-deep-research-embed

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r452 + scenarios
- [x] change artifacts validate (`--strict --no-interactive`)

## Apply（`llman-sdd-apply` · 全程 main）

### 1. 命令注册与解析

- [x] 1.1 `CommandSchema` + `GET /v2/commands` 增加 `kind: 'nav'`（`/research` `/深研` `/research-open`）
- [x] 1.2 解析层 Vitest：合法 slash → open_compose / open_run
- [x] 1.3 `apps/web/AGENTS.md` 文档化语法；标注 chat 辅助

### 2. 导航与预填

- [x] 2.1 `/research` → `/research-lab/:nid` Compose（无 rid）
- [x] 2.2 `/research <topic>` → 同路径 + `?topic=` 预填（不 create）
- [x] 2.3 `/research-open <rid>` → `?rid=`
- [x] 2.4 useChat 发送拦截吞掉；Vitest mock navigate

### 3. 主入口保留

- [x] 3.1 烧瓶 / Compose / 任务抽屉不因本变更移除
- [x] 3.2 AGENTS 标明 chat 为辅助 tier

### 4. 验证

- [x] 4.1 web `test:ci` + root `bun typecheck`
- [x] 4.2 change validate (`--strict --no-interactive`)
