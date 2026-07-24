# Design: c79 retire legacy deep-search entry

## Goals

- 单一清场：搜索入口不再冒充深研；顶栏不再挂 Desk。
- ResearchRun 全栈（router/service/schemas/tests）**只读不删**。

## Non-Goals

- 不改 Lab UX、不写 fixture（c80）。
- 不改 ResearchRun 行为合约（c81）。
- 不接 Eden（c82）。

## Removals / Edits

| 区域                                    | 动作                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `WorkspaceTopbarSearch`                 | 去掉 `deep` tab 与 `DeepResearchDesk`；仅 Fast 网搜                                                    |
| `domains/research/DeepResearchDesk*` 等 | 可删或移入 `_archive`/暂留未挂载；本 change 至少 **切断入口**；优先删除无引用 Desk 树若 typecheck 允许 |
| `SourcesPanelSearchSection.tsx`         | 删除（已无引用）                                                                                       |
| `SEARCH_MODES` / `normalizeSearchMode`  | 去掉 `Deep Research`；测试更新                                                                         |
| i18n `sources.search.*.deep`            | 删除或停用                                                                                             |
| `testids` Legacy HITL                   | 无引用则删                                                                                             |
| shared `SourceSearchRequest.mode`       | describe：网搜元数据；默认 Fast；MUST NOT 文档成深研                                                   |

## Preserve

```
apps/server/src/features/research/**
packages/shared/src/schemas/research.ts
/v2/notebooks/:nid/research*
scripts/smoke-research-live.ts（可留，本 change 不强制跑）
```

## Migration

用户：深研 → 烧瓶进 Lab。网搜 → 顶栏 Fast。

## Risk

误删 research router → 用路径白名单审查 + `just test` research 套件仍绿。
