---
depends_on: [c75-workspace-topbar-search]
---

## Why

旧 Deep Research 已 stub（`POST …/research` → 501），无法支撑产品基线（`docs/product/deep-research-prd.md` v0.2.3）：**ResearchRun 为过程 SSOT**、原子 tools、checkpoint 图、章节引用报告、显式转化（I1+K1）、轻量确认（M1）。c75 已完成顶栏 E1 + 直接搜索；深研 Tab 仍为壳。本 change **落地后端 Runtime full 路径**（替换 stub），FE/xyflow 仅占位，细节由后续 runtime-spec / ui-proto（grill）回填后另波实现。

## What Changes

1. **ResearchRun SSOT（B）**：notebook 作用域下 create / list / get；图、checkpoint、权威 report、citation map 挂在 Run；**不**自动写 Output（B1）。
2. **替换 501 stub**：创建 Run 返回可追踪 id + 初始状态；执行可异步推进（stream/patch 契约在 apply 中定稿）。
3. **原子 tools**：共享既有 `searchWeb`；`retrieveSources` / evidence 读；`synthesizeReport`；禁止深研内第二套 SearXNG。
4. **来源边界（H1）**：create 默认勾选 sourceIds；空则允许外网自研并在 Run 元数据明示；可选 `sourceScope=library`。
5. **深度档位（L1）**：浅 8/12、中 20/30（默认）、深 40/60 → `maxSearches` / `maxNodes`。
6. **M1 确认**：仅「预算将尽」与「扩展支路」两类硬停 API（approve / skip-and-finish）；无逐步审批、无转化弹窗。
7. **转化（G7 / I1 / K1）**：`convertToNote` → Markdown `PARAGRAPH`（GFM `[^n]` 脚注）；`convertToSource` → ingest + embed；转化后可被对话检索。
8. **FE 占位**：E1 深研 Tab / Run 详情 / xyflow **不在本 change 实现**（tasks 占位）；壳可保持至 FE change。
9. **退役**：删除/归档废弃 capability 占位语；OpenAPI/AsyncAPI 与 notebook 隔离对齐 c69。

## Capabilities

- `deep-research-runtime`（**新**）— Run / tools / checkpoint / confirm / convert 合约
- `structural-refinement-for-generated-results` — 从 stub 废弃声明改为指向新 capability 或收窄
- `workspace-api-contract` — research 列表/详情 notebook 作用域（若需 modify）
- `workspace-ui-panels` — **本 change 可不改壳 MUST**（FE 后置）；或仅注明 Runtime 就绪后壳可升级

## Impact

- **BREAKING（API）**：`POST …/research` 不再 501；响应与旧 HITL 会话语义 **不兼容**（NG1：不恢复旧全套）。
- DB：新 Run/graph/checkpoint 表（或等价存储）；旧 research 表已在 stub 时移除。
- 共享：`packages/shared` 新增/恢复 research Run Zod；Eden 跟路由。
- 门禁：server 单测 + 转化后 QA 可命中；`just qa`。
