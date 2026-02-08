# 提案实施拓扑路径

> 仅覆盖"体验优化 + 外部集成"方向的提案。新功能类（auth、collaborative、plugin、templates）和纯基础设施类（docker、observability、ci-pipeline）已排除。

## 重叠与边界澄清

| 提案 A | 提案 B | 重叠点 | 解决方案 |
|--------|--------|--------|---------|
| `optimize-backend-performance` 任务 2.4 | `add-caching-layer` | 嵌入缓存 | **共存**：嵌入缓存是轻量级 LRU（进程内），caching-layer 是通用缓存抽象（memory/Redis）。嵌入缓存先行，caching-layer 后续如需可包装 |
| `add-obsidian-integration` | `enhance-source-batch-ops` | 批量文件上传 | **互补**：Obsidian 专注文件夹导入 + Markdown 预处理，batch-ops 专注已有 source 的批量管理（多选/删除/标签）。无冲突 |
| `optimize-frontend-performance` 任务 3 | `add-error-resilience` 任务 1 | 加载/错误状态 UI | **互补**：骨架屏组件可同时用于 Suspense fallback 和 ErrorBoundary fallback。建议前端性能先建骨架屏库，error-resilience 复用 |

## 依赖关系图

```
                    ┌─────────────────────────┐
                    │     Phase 0: 基础层      │
                    │   （可完全并行实施）      │
                    └─────────────────────────┘
                           │           │
              ┌────────────┘           └────────────┐
              ▼                                     ▼
┌──────────────────────────┐         ┌──────────────────────────┐
│ refactor-state-to-zustand│         │optimize-backend-performance│
│  前端状态管理基础重构    │         │  后端性能全面优化         │
└──────────────────────────┘         └──────────────────────────┘
              │                                     │
              │ 软依赖: Zustand 细粒度订阅           │ 软依赖: 嵌入批处理加速
              │ 使虚拟列表收益最大化                  │ 大量文件导入
              ▼                                     ▼
┌──────────────────────────┐         ┌──────────────────────────┐
│                          │         │                          │
│     Phase 1: 核心优化     │         │     Phase 1: 核心优化     │
│   （可完全并行实施）      │         │   （可完全并行实施）      │
│                          │         │                          │
│ optimize-frontend-       │         │ add-error-resilience     │
│ performance              │         │  错误恢复与健壮性        │
│  前端性能优化             │         │  (负责重试策略和         │
│                          │         │   ErrorBoundary)         │
└──────────────────────────┘         └──────────────────────────┘
              │                                     │
              │                                     │
              ▼                                     ▼
┌──────────────────────────────────────────────────────────────┐
│                    Phase 2: 集成与打磨                        │
│                  （可完全并行实施）                            │
├──────────────────┬───────────────────┬───────────────────────┤
│add-obsidian-     │enhance-ux-polish  │enhance-source-        │
│integration       │ UX 综合打磨       │batch-ops              │
│ Obsidian 集成    │                   │ 来源批量操作           │
├──────────────────┼───────────────────┼───────────────────────┤
│add-dark-mode-v2  │add-keyboard-      │add-output-export-v2   │
│ 深色模式         │shortcuts          │ 输出导出               │
│                  │ 键盘快捷键        │                       │
└──────────────────┴───────────────────┴───────────────────────┘
```

## 推荐实施序列

### Phase 0 — 基础层（并行）

| # | 提案 | 预估工作量 | 备注 |
|---|------|-----------|------|
| 0a | `refactor-state-to-zustand` | 3-5 天 | 前端性能基础，消除 Context 全量重渲染 |
| 0b | `optimize-backend-performance` | 5-7 天 | 后端性能基础，7 个任务组可按序推进 |

**并行条件**: 0a 纯前端，0b 纯后端，无交叉文件。
**验证门槛**: 0a — React DevTools 确认重渲染范围缩小；0b — 基准测试数据达标。

### Phase 1 — 核心优化（并行，Phase 0 完成后）

| # | 提案 | 预估工作量 | 前置依赖 | 备注 |
|---|------|-----------|---------|------|
| 1a | `optimize-frontend-performance` | 3-4 天 | 0a（软依赖） | 虚拟列表 + 懒加载 + 骨架屏。Zustand 完成后虚拟列表项的 re-render 控制更精准 |
| 1b | `add-error-resilience` | 3-4 天 | 0b（软依赖） | 后端重试 decorator + 前端 ErrorBoundary。复用 0b 的超时配置，不重复实现 |

**并行条件**: 1a 前端为主，1b 前后端均有但不与 1a 冲突（ErrorBoundary vs 虚拟列表/懒加载在不同组件层级）。
**验证门槛**: 1a — 100+ 消息滚动帧率 >30fps；1b — 断开 AI 后显示重试 UI。

### Phase 2 — 集成与打磨（并行，Phase 1 完成后）

| # | 提案 | 预估工作量 | 前置依赖 | 备注 |
|---|------|-----------|---------|------|
| 2a | `add-obsidian-integration` | 3-4 天 | 0b（软依赖） | 嵌入批处理就绪后大 vault 导入更快 |
| 2b | `enhance-ux-polish` | 4-5 天 | 1a + 1b（软依赖） | 骨架屏库和 ErrorBoundary 就绪后打磨更顺畅 |
| 2c | `enhance-source-batch-ops` | 3-4 天 | 无 | 与 2a 互补，可同步推进 |
| 2d | `add-dark-mode-v2` | 2-3 天 | 无 | 纯视觉层，完全独立 |
| 2e | `add-keyboard-shortcuts` | 2-3 天 | 无 | 纯交互层，完全独立 |
| 2f | `add-output-export-v2` | 3-4 天 | 无 | 独立功能，优先级最低 |

**并行条件**: 2a-2f 之间无硬依赖，可根据人力同时推进 2-3 个。
**推荐组合**: (2a + 2c) → (2b + 2d) → (2e + 2f)

## 总时间线估算

```
Week 1-2:  Phase 0  ─── [0a: Zustand] ──────────
                     ─── [0b: Backend Perf] ─────

Week 2-3:  Phase 1  ─── [1a: Frontend Perf] ────
                     ─── [1b: Error Resilience] ─

Week 3-5:  Phase 2  ─── [2a: Obsidian] ─────────
                     ─── [2b: UX Polish] ────────
                     ─── [2c: Batch Ops] ────────
                     ─── [2d: Dark Mode] ───
                     ─── [2e: Shortcuts] ───
                     ─── [2f: Export] ──────
```

**总预估**: 4-5 周（假设 1 名全栈开发），2-3 周（假设前后端各 1 人并行）。

## 当前实施状态（2026-02-08）

| 阶段 | 提案 | 状态 | 备注 |
|---|---|---|---|
| 0a | `refactor-state-to-zustand` | ✅ 完成 | `openspec list` 显示 Complete |
| 0b | `optimize-backend-performance` | ✅ 已归档 | 2026-02-07 归档至 `archive/2026-02-07-optimize-backend-performance` |
| 1a | `optimize-frontend-performance` | ✅ 已归档 | 2026-02-08 归档至 `archive/2026-02-08-optimize-frontend-performance` |
| 1b | `add-error-resilience` | ✅ 已归档 | 2026-02-07 归档至 `archive/2026-02-07-add-error-resilience` |
| 2b | `enhance-ux-polish` | ✅ 已归档 | 2026-02-08 归档至 `archive/2026-02-08-enhance-ux-polish`（Source 索引百分比 SSE 相关项移出本变更） |
| 2c | `enhance-source-batch-ops` | ✅ 已归档 | 2026-02-07 归档至 `archive/2026-02-07-enhance-source-batch-ops` |
| 2d | `add-dark-mode-v2` | ✅ 已归档 | 2026-02-08 归档至 `archive/2026-02-08-add-dark-mode-v2` |
| 2e | `add-keyboard-shortcuts` | ✅ 已归档 | 2026-02-08 归档至 `archive/2026-02-08-add-keyboard-shortcuts` |
| 2f | `add-output-export-v2` | ✅ 已归档 | 2026-02-08 归档至 `archive/2026-02-08-add-output-export-v2` |

**下一优先级**: 在继续暂缓 Obsidian 的前提下，下一步可优先评估低耦合提案（例如 `add-database-migration` / `add-backend-dependency-injection`），或整理/合并当前未进入 _SEQ 的草案提案。

## 被排除/暂缓的提案

| 提案 | 分类 | 暂缓原因 |
|------|------|---------|
| `add-obsidian-integration` | 外部集成 | 按当前迭代策略暂缓，优先补齐内置基础能力（上传/同步基础链路） |
| `optimize-batch-embedding` | 性能 | 已被 `optimize-backend-performance` 任务 2 吸收 |
| `add-caching-layer` | 基础设施 | 可在 Phase 0b 嵌入缓存验证后再决定是否需要通用缓存层 |
| `add-database-migration` | 基础设施 | 独立推进，不影响体验优化 |
| `add-backend-dependency-injection` | 代码质量 | 独立推进，可在任意阶段穿插 |
| `add-plugin-architecture` | 新功能 | 架构复杂度高，暂缓 |
| `add-production-docker` | 基础设施 | 生产部署时推进 |
| `add-workspace-templates` | 新功能 | 锦上添花，暂缓 |
