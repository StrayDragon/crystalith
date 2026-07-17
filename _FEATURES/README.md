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

| 维度                    | 数量（约）                                 |
| ----------------------- | ------------------------------------------ |
| 用户 UI 功能（主路径）  | ~88                                        |
| 孤儿 / 存根 / 未挂载 UI | ~15（见 `USER/13-orphaned-and-stubs.md`）  |
| Server HTTP 端点        | ~129                                       |
| API-only（无 UI）       | eval、部分 citations/tasks、RAG 策略配置等 |

## 截图约定

- 路径：`USER/screenshots/<feature-id>.png`
- 索引：[`USER/screenshots/README.md`](USER/screenshots/README.md)
- 示例：`USER/screenshots/chat-panel.png`
- 尚未拍摄的条目在文档中标注「待截图」
- 已拍一批主路径截图（shell / 三栏 / 命令面板 / 诊断 / 移动端等）

## 已移除功能

| 功能                           | 移除日期   | 说明                                                 |
| ------------------------------ | ---------- | ---------------------------------------------------- |
| 知识图谱 / `POST /v2/analysis` | 2026-07-17 | 用户反馈价值低；前后端、spec、`_FEATURES` 条目已删除 |

> NOTE: 待盘点 — 其他功能仍按各条目 NOTE 填写

## 相关代码根目录

- 前端工作区：`apps/web/src/features/workspace/`
- 后端特性路由：`apps/server/src/features/`
- 共享 Schema：`packages/shared/src/schemas/`
