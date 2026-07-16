# USER — 前端 UI 功能索引

Crystalith 工作区（`apps/web/src/features/workspace/`）用户可见功能清单。

## 文档列表

| 文件                                                     | 域                             | 功能数（约） |
| -------------------------------------------------------- | ------------------------------ | ------------ |
| [00-workspace-shell.md](00-workspace-shell.md)           | 工作区外壳、布局、快捷键、主题 | 15           |
| [01-notebooks.md](01-notebooks.md)                       | 笔记本 CRUD / 切换             | 5            |
| [02-templates.md](02-templates.md)                       | 模板选择与管理                 | 3            |
| [03-sessions.md](03-sessions.md)                         | 会话切换与管理                 | 4            |
| [04-messages.md](04-messages.md)                         | 对话面板与消息操作             | 14           |
| [05-sources.md](05-sources.md)                           | 来源面板、导入、标签、连接器   | 18           |
| [06-research.md](06-research.md)                         | 深度研究（Deep Research）      | 4            |
| [08-studio.md](08-studio.md)                             | Studio 笔记与生成工具          | 7            |
| [09-outputs.md](09-outputs.md)                           | Output 查看、导出、队列        | 11           |
| [10-plugins.md](10-plugins.md)                           | 结构化 Output 插件渲染         | 8            |
| [11-settings-diagnostics.md](11-settings-diagnostics.md) | 系统配置与诊断                 | 2            |
| [12-command-palette.md](12-command-palette.md)           | 命令面板                       | 1            |
| [13-orphaned-and-stubs.md](13-orphaned-and-stubs.md)     | 孤儿组件、存根、未使用 Hook    | 3            |

**合计主路径约 88 项 + 孤儿/存根约 3 项。**

## 条目模板

每条功能使用统一字段：名称、位置、入口、操作、Server 依赖、代码路径、截图。

## 截图

见 [`screenshots/README.md`](screenshots/README.md)；命名规则 `<feature-id>.png`。

默认桌面布局：**来源 | 笔记 | 对话**（可拖拽）。
