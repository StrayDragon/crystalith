# apps/web — Vite + React + TypeScript SPA

## Project Structure & Module Organization

- Source code: `src/`
- Static assets: `public/`
- `DESIGN.md` — Crystalith Web 设计系统（token + 视觉原则；改 UI 观感前先读）
- `src/features/workspace/` — main workspace feature
  - `domains/` — business domains (notebooks, sessions, messages, sources, outputs, refine, studio, research)
  - `layout/`, `shared/`, `app/` — workspace scaffolding
- `src/features/research-lab/` — Deep Research **产品** Lab（Eden ResearchRun + SSE）
- `src/features/research-lab-demo/` — Deep Research **演示** Lab（xlsx-lib / fake；仅 DEV 或 `VITE_LAB_DEMO=1`）
- `src/api/` — API client：**Eden** `treaty<App>`（`eden.ts`）一等
- `src/shared/` — shared utilities, Layer system, types

## Design System

- SSOT 文档：包根 [`DESIGN.md`](./DESIGN.md)（YAML tokens + 中文原则）
- 实现侧：Tailwind / `src/app/tailwind.css`、MUI 局部组件；新表面优先对齐 DESIGN token，避免另起一套色板

## Research Lab（产品 Eden；演示隔离）

`/research-lab/:nid`（及 `/report`）是深研**产品主表面**，**仅** Eden `ResearchRun` + SSE（`useEdenLabController` / `EdenLabReportPage`）。旧 `VITE_LAB_FIXTURE` **不再**切换产品权威。

| 产品 `/research-lab`                      | 演示 `/demo/research-lab`（DEV \|\| `VITE_LAB_DEMO=1`） |
| ----------------------------------------- | ------------------------------------------------------- |
| `POST …/research` · `GET …/research` list | `fixtureLabSessionPort` demo 列表                       |
| Run 图 SSOT + SSE `graph_patch`           | `fake/*` + phase 定时回放                               |
| `useEdenLabController` · `?rid=` 切换 Run | `useLabController` · sessionStorage                     |
| 服务端 report + checkpoints               | `labSession` / revisions                                |

演示路由在 `App.tsx` 中仅当 `isLabDemoMode()`（`import.meta.env.DEV || VITE_LAB_DEMO === '1'`）注册；生产默认构建不挂载。流程见 `.agents/skills/cl-prd-demo/SKILL.md`。

**闭环入口**：头像旁烧瓶（任务抽屉）→「新建研究」→ Compose → 创建 Run 并 stream。笔记本切换器旁**不再**放直达烧瓶。入口 **MUST** 只导航产品 `/research-lab`，不得链到 `/demo/...`。

**辅助入口（c99）— workspace chat slash**（不取代烧瓶 / Compose / 任务抽屉）：

| 命令                                  | 行为                                            |
| ------------------------------------- | ----------------------------------------------- |
| `/research` · `/深研`                 | 打开 `/research-lab/:nid` Compose（不创建 Run） |
| `/research <topic>` · `/深研 <topic>` | 同上，并用 `?topic=` 预填主题                   |
| `/research-open <rid>`                | 打开 Lab 并带 `?rid=`                           |

发送时吞掉（不进 QA）。命令列表来自 `GET /v2/commands`（`kind: 'nav'`）。**不做 `@` 提及。**

- 剪枝闭包 **B** 与 server `collectResearchPruneClosure` 对齐（demo `fake/deriveLabState`）；变更走 `llmanspec/changes/update-research-prune-cascade`
- 展示层（`LabGraph`、Compose、任务抽屉壳）可被 demo 复用；产品页无 `LabController | Eden` 联合分支
- 顶栏搜索仅为 Fast 网搜；勿恢复为深研主入口

## Build, Test, and Development Commands

```bash
bun install              # Install dependencies
bun dev                  # Vite dev server (HMR on :3000)
bun test                 # Vitest (watch mode)
bun run test:ci          # Frontend Vitest CI suite (also via root `just test-web` / `just qa`)
bun run test:core        # Minimal UI core regression suite
bun run lint             # Incremental oxlint
bun run lint:all         # Full oxlint
bun run format           # oxfmt
bun run format:check     # Format check (no write)
bun typecheck            # TypeScript typecheck
bun run build            # Production build → dist/
bun preview              # Preview production build
```

## API Client

- **Primary**: Elysia Eden RPC via `src/api/eden.ts`（`treaty<App>`，零 codegen）
- **Types**: 优先 Eden 推断；跨端标称类型用 `@crystalith/shared`；UI-only 类型放 `features/workspace/shared/types.ts`
- **OpenAPI**: 浏览器用 `/openapi`；其他语言 client 从 `/openapi.json` 衍生，不反向生成一等 TS client
- **Removed**: `api/generated/`（c14）、`api/shared-types.ts`（P1.4）

## Coding Style & Naming Conventions

- TypeScript/React: 2-space indentation
- Components: `PascalCase`
- Hooks: `useX`
- Tests: `*.test.tsx` (colocated with source)
- CSS/Tailwind: global styles in `src/app/index.css`; feature styles alongside components
- Formatter: `oxfmt` — keep reformatting scoped
- **拆分准则**：见根 `AGENTS.md`「Component / module split」。默认不拆单处使用的小 JSX；优先 hook + 少数大步组件 / 可复用模块。

## Layer System (z-index Management)

**Never use hardcoded z-index values.** Use the unified Layer system:

| Level      | Value | Usage                                   |
| ---------- | ----- | --------------------------------------- |
| `base`     | 0     | Normal content                          |
| `dropdown` | 100   | Dropdown menus (MenuList)               |
| `popover`  | 200   | Popovers (PopoverContent, Select menus) |
| `modal`    | 300   | Modal dialogs                           |
| `toast`    | 400   | Toast notifications                     |
| `tooltip`  | 500   | Tooltips (always on top)                |

```tsx
// React components — use the hook
import { useLayer } from '../shared/layer';
const { style } = useLayer('modal');

// Material Tailwind components — use LAYER_LEVELS
import { LAYER_LEVELS } from '../shared/layer';
<MenuList style={{ zIndex: LAYER_LEVELS.dropdown }}>...</MenuList>;
```

- `LayerProvider` is already wrapped in `App.tsx`
- Each level has 100 slots for future expansion

## Testing Guidelines

- Vitest + React Testing Library
- Colocate tests with `*.test.tsx` naming
- Run targeted tests for changed areas
- `test:ci` runs deterministic quality gate; `test:core` covers critical paths

## Configuration & Security

- Settings via `config/app.yaml`
- Never commit API keys or tokens
