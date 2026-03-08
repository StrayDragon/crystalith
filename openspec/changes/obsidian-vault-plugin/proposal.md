## Why

旧的 `add-obsidian-integration` 方案把 Obsidian 当作“文件夹批量上传”。这个方向对小型 vault 尚可，但不适合真实用户常见的中大型 vault（数百到数千篇笔记），主要问题有：

- 一次性全量导入成本过高，用户通常只想先接入一部分内容
- vault 会持续变化，单次上传无法表达后续的同步检查
- 如果每个连接器插件都各自实现一套 UI、范围选择、同步对比和导入流程，插件开发成本会持续膨胀，宿主体验也会碎片化

因此，本变更不再把目标定义为“做一个 Obsidian 特制流程”，而是定义为：
**由宿主内置通用的 source connector framework，再由 Obsidian 作为第一个官方连接器插件接入。**

## What Changes

- 删除旧的 `openspec/notplan-changes/add-obsidian-integration` 提案，改为正式变更。
- 已完成：标准 Markdown 上传链路增加 Obsidian 兼容预处理，支持 `wikilink`、`embed`、`frontmatter`。
- 新增：定义 `source connector framework`，由宿主提供通用快照预览、范围选择、同步检查、进度与诊断能力。
- 新增：定义 `SourceConnectorPlugin`，让插件只负责枚举外部资料、读取内容和提供少量特有配置。
- 新增：Obsidian 官方插件作为该 framework 的首个实现，用于验证“大 vault + 选择性导入 + 显式 sync_check”模型。

## Capabilities

### New Capabilities
- `source-connectors`：面向外部知识库/资料仓的连接器框架能力，支持快照、选择性导入、同步检查、绑定状态与诊断。

### Modified Capabilities
- `architecture-plugin-and-agent`：新增 `SourceConnectorPlugin` 类插件接口，并纳入统一发现、启用、兼容性与诊断体系。
- `source-ingestion-upload-and-url`：标准 Markdown 上传需要兼容常见 Obsidian Markdown 语法，并把可提取的 frontmatter 写入来源元数据。

## Impact

- Backend
  - 当前已落地 Markdown 预处理基础，可作为未来连接器插件的共用能力。
  - 本变更范围内将新增 `SourceConnectorPlugin`、notebook-scoped connector binding、快照与 sync_check 结果模型。
- Frontend
  - 宿主需要提供通用连接器工作流壳子：连接参数、快照预览、范围选择、同步检查结果、导入进度与错误展示。
  - v1 中插件不自带连接器工作流 UI；连接器交互统一由宿主提供。
- 插件开发体验
  - 插件作者只需实现外部资料枚举、内容读取和少量特有参数，而不需要重复开发整套交互流程。
- 产品体验
  - 所有连接器共享一致的交互体验，避免 Obsidian、Git 文档仓、其他本地知识库各自长成不同系统。
