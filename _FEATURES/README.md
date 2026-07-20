# Crystalith 功能盘点文档

本目录为 **功能清单（Feature Inventory）**，供后续清理、裁剪、合并决策使用。仅记录「有什么」，不做价值判断。

## 如何使用

1. 浏览 [`USER/`](USER/)（前端 UI 功能）与 [`SERVER/`](SERVER/)（后端 API / 能力）。
2. 对照 [`MATRIX.md`](MATRIX.md) 查看用户功能与 Server 路由的映射关系。
3. 在每个功能条目下方的 `> NOTE:` 行填写盘点结论（保留 / 删除 / 合并 / 待观察等）。
4. 默认占位为 `待盘点`；由人工填写后续决策。

### NOTE 行约定

```markdown
> NOTE: 待盘点
```

填写示例（由评审人自行决定）：

```markdown
> NOTE: 保留 — 核心对话路径
> NOTE: 删除 — 无 UI 入口，v1 遗留
> NOTE: 合并到 studio-panel
```

## 目录结构

| 路径                                                                                    | 内容                           |
| --------------------------------------------------------------------------------------- | ------------------------------ |
| [`USER/README.md`](USER/README.md)                                                      | 用户界面功能索引               |
| [`USER/00-workspace-shell.md`](USER/00-workspace-shell.md) … `13-orphaned-and-stubs.md` | 按域划分的 UI 功能条目         |
| [`USER/screenshots/`](USER/screenshots/)                                                | 功能截图（`<feature-id>.png`） |
| [`SERVER/README.md`](SERVER/README.md)                                                  | 后端域与端点总览               |
| [`SERVER/00-system.md`](SERVER/00-system.md) … `15-cross-cutting.md`                    | 按域划分的 API / 能力条目      |
| [`MATRIX.md`](MATRIX.md)                                                                | 用户功能 ↔ Server 路由对照表   |

## 规模摘要

| 维度                                       | 数量（约）                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 用户 UI 功能（主路径）                     | ~88                                                                                      |
| 孤儿 / 存根 / 未挂载 UI                    | ~3（见 `USER/13-orphaned-and-stubs.md`）                                                 |
| Server HTTP 端点                           | ~128                                                                                     |
| dead-candidate（无用户功能，文档已标可删） | refine*、tasks*、eval*、strategies HTTP、outputs/types、qa/presets、citations/context 等 |

对照与对齐审计：[`MATRIX.md`](MATRIX.md)、[`API-ALIGNMENT-REPORT.md`](API-ALIGNMENT-REPORT.md)。**以当前代码为准**；文档 NOTE 领先于删码。

## 截图约定

- 路径：`USER/screenshots/<feature-id>.png`
- 索引：[`USER/screenshots/README.md`](USER/screenshots/README.md)
- 示例：`USER/screenshots/chat-panel.png`
- 尚未拍摄的条目在文档中标注「待截图」
- 已拍一批主路径截图（shell / 三栏 / 命令面板 / 诊断 / 移动端等）

## 已移除功能

| 功能                           | 移除日期   | 说明                                                                                                                                                                            |
| ------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 知识图谱 / `POST /v2/analysis` | 2026-07-17 | 用户反馈价值低；前后端、spec、`_FEATURES` 条目已删除                                                                                                                            |
| 孤儿前端 UI 存根批次           | 2026-07-17 | RefinePanel、OutputTypeSelector、音视频概览/播放器、消息 stats 卡片（Answer/BarChart/DataTable/ToolAction/JsonFallback）、`useTasks`；`useRefine` 与 `/v2/refine*` API 当时保留 |
| `useRefine` refine-job 死路径  | 2026-07-17 | 删除 refineTemplates；仅保留 Studio/output queue 路径                                                                                                                           |

## 已决策待删码（2026-07-20，文档先行）

无用户功能的 HTTP / 整域，按「仅测/BDD 不算活功能」标为 **dead-candidate**（见 MATRIX / API-ALIGNMENT / 各 SERVER 域 NOTE）：

- `/v2/refine*`、`/v2/tasks*`、`/v2/eval/*`
- `GET /v2/strategies` + notebook strategies HTTP（保留 `ragRegistry`）
- `GET /v2/outputs/types`、`GET /v2/qa/presets`、`GET .../citations/context`

仍保留并补缺口：`DELETE .../source-connector-bindings`（补解绑 UI）；research `modify`（修假勾选）。

> NOTE: 删码前走 SDD（缩 live specs）；未删前 OpenAPI 仍会列出上述路径

## 相关代码根目录

- 前端工作区：`apps/web/src/features/workspace/`
- 后端特性路由：`apps/server/src/features/`
- 共享 Schema：`packages/shared/src/schemas/`
