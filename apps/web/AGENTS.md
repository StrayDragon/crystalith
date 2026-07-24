# apps/web — Vite + React + TypeScript SPA

## Project Structure & Module Organization

- Source code: `src/`
- Static assets: `public/`
- `DESIGN.md` — Crystalith Web 设计系统（token + 视觉原则；改 UI 观感前先读）
- `src/features/workspace/` — main workspace feature
  - `domains/` — business domains (notebooks, sessions, messages, sources, outputs, refine, studio, research)
  - `layout/`, `shared/`, `app/` — workspace scaffolding
- `src/features/research-lab/` — Deep Research **UX Lab**（fake 运行时；深研主表面入口）
- `src/api/` — API client：**Eden** `treaty<App>`（`eden.ts`）一等
- `src/shared/` — shared utilities, Layer system, types

## Design System

- SSOT 文档：包根 [`DESIGN.md`](./DESIGN.md)（YAML tokens + 中文原则）
- 实现侧：Tailwind / `src/app/tailwind.css`、MUI 局部组件；新表面优先对齐 DESIGN token，避免另起一套色板

## Research Lab（mock vs real）

`/research-lab` 是交互原型与当前深研主表面入口；生产 ResearchRun API 在 server，Lab 接 Eden 见后续 c80+。

| Lab（本目录）                             | Real（ResearchRun）             |
| ----------------------------------------- | ------------------------------- |
| `fake/*` + `deriveLabState`               | Run 图 SSOT + SSE `graph_patch` |
| `useLabController` 本地突变               | Eden `…/nodes/:id/{prune,fork}` |
| phase 定时回放                            | Run 状态机 + stream             |
| `labSession` / revisions → sessionStorage | 服务端 report + checkpoints     |

- 剪枝闭包 **B** 与 server `collectResearchPruneClosure` 对齐（`fake/deriveLabState`）；变更走 `llmanspec/changes/update-research-prune-cascade`
- 接 Eden 时：保留 `LabGraph` / 报告 Plate 等展示层，替换 `fake/` 下 controller / data 端口
- 顶栏搜索仅为 Fast 网搜；勿再挂载已退役的 DeepResearchDesk

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
