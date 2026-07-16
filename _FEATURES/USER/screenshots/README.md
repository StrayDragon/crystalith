# 截图索引

拍摄环境：`just dev`（web `localhost:3000` + server `:8032`），Playwright + 系统 Chrome channel，2026-07-17。

> NOTE: 待盘点 — 截图是否足够覆盖删减决策；未拍到的功能仍标「待截图」

## 已拍摄

| 文件                        | 对应 Feature ID        | 说明                       |
| --------------------------- | ---------------------- | -------------------------- |
| `workspace-app-shell.png`   | `workspace-app-shell`  | 桌面三栏工作区全貌         |
| `workspace-header.png`      | `workspace-header`     | 顶栏（与 shell 同帧）      |
| `workspace-header-menu.png` | `workspace-header`     | 头像菜单展开               |
| `notebook-switcher.png`     | `notebook-switcher`    | 笔记本下拉                 |
| `command-palette.png`       | `command-palette`      | Ctrl+K（若未弹出请重拍）   |
| `shortcut-help-panel.png`   | `shortcut-help-panel`  | 快捷键帮助                 |
| `sources-panel.png`         | `sources-panel`        | 来源面板（同帧含三栏）     |
| `chat-panel.png`            | `chat-panel`           | 对话面板                   |
| `studio-panel.png`          | `studio-panel`         | 笔记/Studio 面板           |
| `system-config-dialog.png`  | `system-config-dialog` | 系统配置（prompt presets） |
| `diagnostics-dialog.png`    | `diagnostics-dialog`   | 健康/诊断                  |
| `mobile-panel-tabs.png`     | `mobile-panel-tabs`    | 390×844 移动底栏           |

## 已移除功能截图

| 原文件                     | 说明                                     |
| -------------------------- | ---------------------------------------- |
| `knowledge-graph-view.png` | 知识图谱已移除（2026-07-17），截图已删除 |

## 实机观察（写入文档时的校正）

- 当前本地布局常见顺序为：**来源 | 笔记 | 对话**（GridStack 可拖拽，可能与默认布局不同）。
- 诊断页可见插件：faq / guide / timeline / mindmap / quiz / briefing / slides / paragraph / bullets / structured。
- 笔记列表中出现 `INVALID_TYPE` 输出条目 —— 见 `USER/13-orphaned-and-stubs.md` 与 outputs 相关 NOTE。

## 建议补拍（未做）

- `source-connectors-wizard`、`source-detail-dialog`、`extractor-policy-dialog`
- `research-detail-panel`、`research-capsule`
- `slides-studio-dialog`
- 各 output 交互查看器（FAQ/Quiz/Mindmap/…）
- `template-picker` / `template-manager`
- `chat-slash-commands`（输入 `/`）
- `chat-citations` 弹层
