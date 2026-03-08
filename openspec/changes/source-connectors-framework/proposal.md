## Why

Crystalith 现在已经有上传文件、从 URL 导入、以及正在讨论的 vault 类接入需求。但如果每新增一种资料源都单独做一套导入入口、预览界面、范围选择和同步逻辑，系统会很快碎片化：

- 用户面对不同资料源时会遇到完全不同的交互流程
- 插件作者需要重复开发相似的接入逻辑和 UI 配套
- 宿主难以统一控制诊断、权限、同步、错误恢复和大规模导入体验

因此，这个 proposal 的重点不是某一个 connector，而是先把 **source connectors framework** 做成宿主能力，再让具体连接器在其上实现。

## What Changes

- 新增 `SourceConnectorPlugin` 作为一等插件接口
- 宿主内置通用连接器工作流：连接参数、快照预览、范围选择、同步检查、进度与诊断
- 采用 notebook-scoped connector binding 保存连接状态与同步基线
- 将外部资料接入统一为 `snapshot / import_scope / sync_check` 模型
- 所有后续连接器默认复用宿主壳子，而不是各自发明一套流程

## Before / After

### 实现前
- 新资料源往往会演变成专用导入功能
- 导入流程、错误提示和同步逻辑很难统一
- 每个 connector 都可能带来一套新的前端和后端接线成本

### 实现后
- 外部资料接入成为统一框架能力
- 宿主提供一致的连接器 UI 和诊断行为
- 新 connector 主要只需实现枚举、读取和少量特有配置

## 优点

- 平台化收益最大，后续扩展其他知识源成本更低
- 用户体验一致，减少认知负担
- 更利于治理大规模导入、同步检查和错误恢复

## 风险与代价

- 短期会先投入在框架而不是单个高感知功能
- 如果抽象过早，接口可能带上当前样例的偏见
- 宿主需要承担更多通用 UI 和状态复杂度

## Capabilities

### New Capabilities
- `source-connectors`: 宿主级连接器框架、binding、同步检查和诊断能力

### Modified Capabilities
- `architecture-plugin-and-agent`: 新增 `SourceConnectorPlugin` 接口并纳入统一插件治理
- `workspace-api-contract`: 暴露连接器发现、binding、snapshot、导入和 sync_check 端点
- `official-plugins`: 官方 connector 的安装/启用说明需要统一进入官方插件矩阵

## Impact

- Backend
  - 新增 connector 插件接口、binding 模型与通用 diff 逻辑
- Frontend
  - 新增统一连接器工作流壳子
- Product
  - Crystalith 从“多个导入功能集合”升级为“可扩展知识源宿主”
