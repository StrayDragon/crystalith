# c41-upgrade-v2-typescript-7 — Tasks

## 1. 升级 typescript 依赖版本

- [x] `apps/server/package.json`: `"typescript": "^5"` → `"typescript": "^7"`
- [x] `apps/web/package.json`: `"typescript": "^5.9.2"` → `"typescript": "^7"`
- [x] `packages/shared/package.json`: `"typescript": "^5"` → `"typescript": "^7"`

## 2. 安装 + 验证基础 typecheck

- [x] `bun install`（拉 typescript@7.0.2 + 平台原生二进制）
- [x] `cd apps/server && bun run typecheck`（tsc --noEmit，Go 二进制）✅ clean
- [x] `cd packages/shared && bun run typecheck` ✅ clean
- [x] `cd apps/web && bun run typecheck`（tsc -p tsconfig.json --noEmit）22 pre-existing errors (no regressions)

## 3. 统一 tsconfig moduleResolution

- [x] `apps/web/tsconfig.json`: `"moduleResolution": "Bundler"` → `"bundler"` + removed `baseUrl` (TS 7.0 removed) + added `allowImportingTsExtensions` + fixed `rivu-*` paths to `./vendor/...`
- [x] `apps/web/tsconfig.node.json`: `"moduleResolution": "Bundler"` → `"bundler"`

## 4. 修复 TS 7.0 新引入的类型错误

- [x] 修复 server typecheck 中任何新错误 — ✅ 0 errors (clean)
- [x] 修复 shared typecheck 中任何新错误 — ✅ 0 errors (clean)
- [x] 修复 web typecheck 中任何新错误 — ✅ 8 TS 7.0 regressions fixed (baseUrl removal, RefObject null assignability, fetch preconnect, IntersectionObserver scrollMargin, rivu-* paths). Remaining 22 are pre-existing.
- [x] 检查 `@types/bun@latest` 是否需要升级 — ✅ `@types/bun@1.3.14` already latest, no upgrade needed

## 5. 全链路验证

- [x] `bun typecheck`（根 workspace 全量 typecheck）— server ✅, shared ✅, web 22 pre-existing
- [x] `bun test`（全测试，确认无回归）— 260 pass / 85 fail (all pre-existing: web needs vitest with jsdom, server network test timeout)
- [x] `bun lint`（oxlint，不依赖 tsc）— pre-existing warnings + 10 errors, no new
- [x] `bun lint:type-aware`（oxlint type-aware）— ✅ 已安装 oxlint-tsgolint@0.24.0，type-aware lint 工作正常。输出的 errors/warnings 均为既有代码问题，非工具链问题。

## 6. 文档 + commit

- [x] 更新 `PROGRESS.v2.md`：记录 TS 7.0.2 升级 + Go 原生编译器切换
- [ ] `git commit -m "dev: upgrade typescript to ^7 (Go native tsc, ~10x faster)"`
