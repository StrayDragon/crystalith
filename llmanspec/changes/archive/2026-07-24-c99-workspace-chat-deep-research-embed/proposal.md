---
depends_on: [c82-wire-lab-eden]
---

## Why

c80 inventory **G6** 将工作区对话 `@` / `/` 创建或引用深研 Run **defer**；主路径已由烧瓶 + Lab Compose + 任务抽屉覆盖，但用户仍期望在 workspace chat 内快速发起或深链深研。本变更在**不取代** Lab 主入口的前提下，补齐 chat 命令面，对齐 r420「Lab 为深研主表面」的辅助入口。

## What Changes

1. **Chat 命令**：工作区 chat 输入 MUST 支持 `@` 提及或 `/`（或文档化 slash 命令）以：**创建** ResearchRun（预填 Compose 或直达创建）、**深链**已有 Run、或 **打开 Lab**（`/research-lab/:nid` + `?rid=`）。
2. **非唯一入口**：MUST NOT 移除或弱化烧瓶 / Lab Compose / 任务抽屉；chat 为辅助捷径。
3. **Eden 默认**：创建/深链 MUST 经 Eden + shared 类型（c82）；fixture 不作为默认。
4. **文档**：在 `apps/web/AGENTS.md` 或等价处列出支持的 slash / `@` 语法（若实现为单一机制则文档说明）。
5. **质量**：Vitest 命令解析 + 导航回调；可选 e2e 冒烟（完整 Eden 路径在 c100）。

## Locked decisions

- **BDD-off**；Apply：**全程 main**（本 change archive+commit 后才开下一条）
- Fixture 保留至 c100；产品默认 Eden
- **c99 本波保留**（U9）；MUST NOT 再 defer
- Lab Compose + 烧瓶仍为 **primary** 深研入口
- **K1=B** `GET /v2/commands` + `kind:nav` · **K2=A** · **K3=A** · **K4=slash-only** · **K5=A** · **K6=A+C**
- **本波 MUST NOT 再延后**

## Capabilities

- `deep-research-ui` — 工作区 chat 深研捷径（workspace 接缝见 Impact）

## Impact

- depends_on c82（Eden create/list/get Run）
- 主要触及 `apps/web/src/features/workspace/` chat 输入与命令注册；路由复用 `labRouting` / `openDemoResearchTask` 模式
- 无服务端 API 变更
- 对齐 c80 inventory G6 deferred → 本变更关闭

## Seams

- workspace chat 输入 / command registry（`@` 补全、`/` slash）
- `labRouting` — `/research-lab/:nid` 导航
- Eden `createResearchRun` / `listRuns` — 创建与选取 Run
- `WorkspaceHeader` 烧瓶入口 — 保持并列可达
