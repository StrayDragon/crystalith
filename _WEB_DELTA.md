# Crystalith v2 — Frontend Delta (v1 → v2)

> **状态**: 初始快照 — 2026-07-14
> **关联**: [PROGRESS.v2.md](./PROGRESS.v2.md) · [PROGRESS.v2.e2e.md](./PROGRESS.v2.e2e.md)
> **v1 参考**: `/tmp/crystalith-v1-frontend/frontend/web/src/` (git worktree from `main`)

---

## 目录

1. [架构变更](#1-架构变更)
2. [代码差异](#2-代码差异)
3. [UI 组件对照](#3-ui-组件对照)
4. [残留迁移项](#4-残留迁移项)
5. [已知 UX 差异](#5-已知-ux-差异)
6. [决策记录](#6-决策记录)

---

## 1. 架构变更

### 1.1 运行时/构建

| 维度        | v1 (main)                 | v2-dev                                                | 影响                |
| ----------- | ------------------------- | ----------------------------------------------------- | ------------------- |
| 包管理器    | `pnpm`                    | `bun`                                                 | scripts 语法差异    |
| React       | 19.2.3                    | **18.2.0** (锁定)                                     | 无 Hooks 破坏性差异 |
| MUI         | `@mui/icons-material`     | +`@emotion/react` +`@emotion/styled` +`@mui/material` | CSS-in-JS 引擎      |
| 格式化/lint | `oxfmt` / `oxlint` (本地) | 委派 root `bun format` / `bun lint`                   | 统一管理            |

### 1.2 API 通信层 — 核心变更

```
v1:  api/generated/<sdk.gen.ts>  →  fetch (hey-api generated)
                                    ↓
v2:  api/eden.ts                  →  @elysiajs/eden treaty RPC
     api/stream.ts                →  自实现 SSE 流式解析
     api/parseServerError.ts      →  集中错误归一化
     api/shared-types.ts          →  手工维护的类型 (替代 generated/)
```

**调用方式对比:**

```ts
// v1 (hey-api generated)
import { createNotebook } from '../../api/generated';
const result = await unwrapData(createNotebook<true>({ body: { name } }));

// v2 (Eden treaty)
import { api } from '../../api/eden';
const { data, error } = await api.v2.notebooks.post({ name });
```

### 1.3 文件结构

```
v1: frontend/web/src/           v2: apps/web/src/
         │                               │
         ├── api/generated/              ├── api/
         │   ├── types.gen.ts            │   ├── eden.ts         (NEW)
         │   ├── sdk.gen.ts              │   ├── stream.ts       (NEW)
         │   ├── client.gen.ts           │   ├── parseServerError.ts (NEW)
         │   └── ...                     │   ├── shared-types.ts (NEW)
         ├── api/                        │   └── (generated/ 残留)
         │   ├── setup.ts     (DEL)      │
         │   ├── unwrap.ts    (DEL)      │
         │   └── generated/              │
         └── features/workspace/         └── features/workspace/
             └── (same subdirs)              └── (same subdirs)
```

> **文件变更清单**: v2 新增 4 文件 (`eden.ts`, `stream.ts`, `parseServerError.ts`, `shared-types.ts`), 删除 2 文件 (`api/setup.ts`, `api/unwrap.ts`)。所有组件文件**保留原名**，仅引号风格和 import 排序不同。

---

## 2. 代码差异

### 2.1 全局风格差异

所有的 `.ts` / `.tsx` 文件都经历了:

| 变更        | v1                   | v2                   | 原因                  |
| ----------- | -------------------- | -------------------- | --------------------- |
| 引号        | `""`                 | `''`                 | formatter (oxfmt→bun) |
| import 排序 | 外部→内部 特定分组   | 按字母重排           | formatter 规则变化    |
| 类型导入    | inline `import type` | inline `import type` | 无变化                |

### 2.2 业务逻辑差异

经过逐文件 diff 确认: **所有 domain hooks (`useNotebooks`, `useChat`, `useSources`, `useResearch`, `useRefine`, `useStudio`, `useAnalysis`) 和 UI 组件 (`WorkspaceLayout`, `StudioPanel`, `AnalysisPanel`, `KnowledgeGraphView`, `GenericOutputRenderer`, etc.) 的业务逻辑完全相同。**

差异仅限于:

- **API 调用语法** (`api.v2.xxx` vs 导出的函数名)
- **SSE 事件结构** (v2 规范化 `{ iteration, data: {...} }` vs v1 扁平字段)
- **错误处理** (v2 集中 `parseServerError` vs v1 内联解析)

### 2.3 SSE 事件差异

| 事件类型        | v1 结构                                                 | v2 结构                                                                                         |
| --------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| plan_ready      | `{ queries: [], reasoning: string, iteration: number }` | `{ iteration: number, data: { queries: [], reasoning: string } }`                               |
| search_progress | `{ iteration, result_count, new_results }`              | `{ iteration, data: { result_count?, new_results?, queries_executed? } }`                       |
| analysis        | `{ iteration, summary, coverage, need_more_search }`    | `{ iteration, data: { summary?, coverage?, coverageEstimate?, needMore?, need_more_search? } }` |

---

## 3. UI 组件对照

### 输出渲染器 (Outputs) — 全部对齐 v1

以下 7 个输出类型已全部在 `OutputContent.tsx` 中添加特判分支，优先级高于 `renderDescriptor`，实现与 v1 plugin system 完全相同的交互式渲染：

| 类型         | 组件                     | 交互行为                                     | 文件                        |
| ------------ | ------------------------ | -------------------------------------------- | --------------------------- |
| **MINDMAP**  | `MindmapViewer`          | ReactFlow 交互式树形图（缩放/拖拽/色彩深度） | `OutputContent.tsx:98-104`  |
| **FAQ**      | `FlashcardViewer`        | 点击翻转卡（空格键翻转，左右键切换）         | `OutputContent.tsx:105-114` |
| **QUIZ**     | `QuizRunner`             | 选答→提交→评分反馈（进度条/正确率）          | `OutputContent.tsx:115-124` |
| **GUIDE**    | `GuideChecklist`         | 勾选完成项+折叠展开模块                      | `OutputContent.tsx:125-134` |
| **TIMELINE** | `TimelineViewer`         | 展开/折叠事件详情                            | `OutputContent.tsx:135-144` |
| **BRIEFING** | `ReportViewer`           | 目录侧栏导航+平滑滚动+折叠章节               | `OutputContent.tsx:145-154` |
| **SLIDES**   | `SlidesMarkdownRenderer` | 逐页渲染+Markdown原始切换                    | `OutputContent.tsx:158-164` |

### 3.x 输出渲染器 (Outputs) — 旧对照

### 3.2 知识图谱 / 分析面板

| 组件                     | 功能               | v1→v2 差异        |
| ------------------------ | ------------------ | ----------------- |
| `AnalysisPanel.tsx`      | 主题+关系列表      | 仅引号风格        |
| `KnowledgeGraphView.tsx` | ReactFlow 知识图谱 | 仅引号/import排序 |

### 3.3 工作区布局

`WorkspaceLayout.tsx` — 逻辑完全一致。GridStack 三栏布局（来源 / 笔记 / 对话）。

### 3.4 插件系统

`plugins/` 目录一致，`registerPlugins.ts` 引用方式相同。

---

## 4. 残留迁移项

### 4.1 `api/generated/` 类型导入 (c14)

**14 个文件仍导入 `api/generated/`**，全部是类型导入:

**应该迁移的 (12 个 type-only):**

```ts
// 现在: 从 api/generated 导入类型
import type { AnalysisResult, Topic, Relation } from '../../../../api/generated';

// 迁移到: @crystalith/shared 或 api/shared-types.ts
import type { AnalysisResult, Topic, Relation } from '@crystalith/shared';
```

**需要 mock 改造的 (2 个测试文件):**

```ts
// useChat.test.tsx, setupTests.ts 导入 client 做 MSW mock
// 迁移方案: 用 api/eden.ts 的 treaty client 替代 generated client.gen
```

### 4.2 尚未验证的端点

通过 CDP DOM 检查，以下功能区域的用户交互路径待验证:

- [ ] 输出卡片点击后的详情弹窗 (StudioOutputViewer)
- [ ] 知识图谱节点交互 (KnowledgeGraphView → 节点点击)
- [ ] 来源详情弹窗 (SourceDetailDialog)
- [ ] 研究会话 SSE 流式 (useResearch)
- [ ] 幻灯片配置弹窗 (StudioPanel → SLIDES config)

---

## 5. 已知 UX 差异

| #   | 差异                                                       | 严重度    | 状态                                            |
| --- | ---------------------------------------------------------- | --------- | ----------------------------------------------- |
| D1  | `GenericOutputRenderer` 新增 `CitedText` 处理              | ✅ 修复   | 已合并                                          |
| D2  | `StudioOutputViewer` 增加 `position:relative` 修复指针事件 | ✅ 修复   | 已合并                                          |
| D3  | React 18.2.0 锁定（v1 = 19.x）                             | ⚠️ 观察   | 无冲突                                          |
| D4  | API 响应字段名差异（camelCase vs snake_case）              | ⚠️ 待验证 | `shared-types.ts` 用 `Record<string, any>` 兜底 |
| D5  | SSE 事件 data 结构嵌套层级变化                             | ✅ 适配   | `stream.ts` 和 hooks 已处理                     |
| D6  | 知识图谱节点类型枚举变化 (v1 → v2)                         | ⚠️ 待验证 | 来自 `api/generated` 类型                       |

---

## 6. 决策记录

| 日期       | 决策                          | 原因                               |
| ---------- | ----------------------------- | ---------------------------------- |
| 2026-07-14 | Eden treaty 替代 hey-api SDK  | 零代码生成，编译时类型安全         |
| 2026-07-14 | 自实现 SSE 流式解析           | Eden 不原生支持 stream             |
| 2026-07-14 | React 锁定 18.2.0             | 兼容性问题（见 PROGRESS 开放决策） |
| 2026-07-14 | `@elysiajs/openapi` Scalar UI | 自动路由发现，零手工维护           |

---

## 如何更新此文档

```bash
# 更新后刷新 v1 快照
cd /tmp && rm -rf crystalith-v1-frontend && cd /home/l8ng/Projects/__straydragon__/crystalith && git worktree add /tmp/crystalith-v1-frontend main

# 重新对比关键目录
diff -r --exclude=node_modules --exclude=dist --exclude=.git /tmp/crystalith-v1-frontend/frontend/web/src/ apps/web/src/
```

---

## 7. 已修复的 v1→v2 UX 差异

### D7: MINDMAP 输出渲染为线性树而非交互式图

| 属性     | 值                                                                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 报告日期 | 2026-07-14                                                                                                                                                              |
| v2 状态  | ✅ 已修复                                                                                                                                                               |
| 文件名   | `apps/web/src/features/workspace/domains/outputs/OutputContent.tsx`                                                                                                     |
| 根因     | MINDMAP 没有 `frontend_bundle` 注册，`bundleRenderer` 为 null，回退到 `renderDescriptor` 的 `GenericOutputRenderer`（线性树）而非 `MindmapViewer`（ReactFlow 交互式图） |
| 修复     | 在 `OutputContent.tsx` 的 `body` 渲染路由中，在 `renderDescriptor` 之前添加 `typeId === 'MINDMAP'` 分支，直接分发到 `<MindmapViewer>`                                   |
| 验证     | CDP DOM 检查确认 `.StructuredMindmapInteractive` 类 + ReactFlow wrapper 存在                                                                                            |
