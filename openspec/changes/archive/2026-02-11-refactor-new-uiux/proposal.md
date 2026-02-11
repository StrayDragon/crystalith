## Why

当前 UI 采用固定三栏布局，缺乏用户自定义能力。需要迁移到 Modular Canvas（GridStack 模块化自由布局）架构，让用户自由拖拽、缩放功能模块，打造个性化工作空间。

在此迁移过程中，Studio 面板的工具区（ExtractTo）与输出/笔记列表区（Notes）当前上下堆叠。为优化空间利用，工具区应支持收纳/隐藏——用户不需要触发生成时可以折叠工具区，将空间留给输出和笔记列表。

## What Changes

- **迁移到 Modular Canvas 布局**：将固定三栏布局替换为 GridStack 模块化自由布局，支持拖拽、缩放、自由定位。
- **Studio 面板工具区可收纳**：Studio 仍为单一模块，但内部工具区（ExtractTo）支持折叠/展开切换，折叠后空间释放给输出/笔记列表。
- **模块目录 + ⌘K 命令面板**：提供模块目录（添加/移除模块）和命令面板（快速操作一切）。
- **锁定/编辑模式**：编辑布局后可锁定防止误操作。
- **所有现有功能完整迁移**：69 项功能在新布局下完整可达。

## Capabilities

### New Capabilities
- `modular-canvas-layout`: GridStack 模块化自由布局，支持拖拽、缩放、12 列网格对齐。
- `command-palette`: ⌘K 命令面板，快速操作模块添加/移除、布局切换等。
- `studio-collapsible-tools`: Studio 模块内工具区可收纳/展开。

### Modified Capabilities
- `workspace-ui`: 从固定三栏布局改为模块化自由布局，所有面板变为独立 widget。
- `studio-panel`: 工具区增加折叠/展开交互，折叠后空间释放给输出列表。

## Impact

- **前端布局**：整体布局架构从固定三栏变为 GridStack 模块化，需要重构布局层。
- **Studio 面板**：内部结构增加折叠逻辑，工具区可收纳。
- **新增依赖**：GridStack.js v12.4.2（MIT, ~63KB gzipped）。
- **新增组件**：模块目录、命令面板、GridStack 桥接层。
- **无后端变更**：纯前端变更。
