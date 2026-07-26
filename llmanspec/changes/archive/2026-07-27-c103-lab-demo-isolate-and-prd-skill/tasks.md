# Tasks: c103-lab-demo-isolate-and-prd-skill

## Propose（本阶段）

- [x] proposal + design + live specs（ui r456–r458 + MODIFIED fixture 权威条款）
- [x] attach feature 分支 + base_sha=c102 tip

## Apply（`llman-sdd-apply`）

### 1. Demo 目录与路由

- [x] 1.1 新建 `research-lab-demo/`；迁入 `fake/`、fixture session/controller、demo 任务相关
- [x] 1.2 `/demo/research-lab/:nid` (+ report)；仅 DEV \|\| `VITE_LAB_DEMO=1` 注册
- [x] 1.3 demo 路由 parse/navigate helpers + Vitest

### 2. 产品去 fixture

- [x] 2.1 `ResearchLabPage` / `App` / Workspace 入口去掉 `VITE_LAB_FIXTURE` 权威切换
- [x] 2.2 产品无 `LabController | Eden` 联合分支
- [x] 2.3 更新/迁移受影响 Vitest import

### 3. Skill + 文档

- [x] 3.1 `.agents/skills/cl-prd-demo/SKILL.md` 骨架
- [x] 3.2 `apps/web/AGENTS.md`：产品 Eden / demo 路径与开关

### 4. 验证

- [x] 4.1 `bun typecheck` + 相关 web Vitest + research 单测冒烟
- [x] 4.2 `llman sdd validate c103-lab-demo-isolate-and-prd-skill --strict --no-interactive`
