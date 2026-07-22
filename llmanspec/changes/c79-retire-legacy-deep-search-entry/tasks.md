# Tasks: c79-retire-legacy-deep-search-entry

## 0. 护栏

- [ ] 0.1 列出 `apps/server/src/features/research/**` 与 shared research schema 为 **禁止删除** 清单；PR 自检勾选

## 1. FE 入口拆除

- [ ] 1.1 顶栏 `WorkspaceTopbarSearch` 移除 deep tab / Desk；仅 Fast
- [ ] 1.2 删除或切断 `DeepResearchDesk` 挂载与无引用 Desk 树（保留 Lab 入口）
- [ ] 1.3 删除 `SourcesPanelSearchSection` 与 Deep mode 类型/utils/测试
- [ ] 1.4 清理 deep-search i18n 与无用 legacy research testid

## 2. 网搜 mode 语义

- [ ] 2.1 shared：`SourceSearchRequest.mode` 描述改为网搜通道元数据；默认 Fast；文档禁止称深研
- [ ] 2.2 FE `handleSearch` / 顶栏固定 Fast（或等价）；不再传 `Deep Research`
- [ ] 2.3 服务端 sources.search：若有 Deep 分支逻辑则删除；**不**改 research router

## 3. 验证

- [ ] 3.1 `bun typecheck` + 定向 Vitest（topbar / sources mode）
- [ ] 3.2 `cd apps/server && bun test tests/research` 仍通过（证明未伤 ResearchRun）
- [ ] 3.3 `llman sdd validate c79-retire-legacy-deep-search-entry --strict --no-interactive`
