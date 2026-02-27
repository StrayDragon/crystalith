## ADDED Requirements

### Requirement: Workspace provides guided empty states
Workspace MUST 在首次进入与关键空态下提供分层引导，明确下一步动作与成功路径。

#### Scenario: No backend connection
- **WHEN** 前端无法连接后端或连接状态为 error
- **THEN** Workspace SHALL 显示可见的错误提示
- **AND** 提供“重试连接/查看诊断/打开部署文档”的可操作入口

#### Scenario: Notebook exists but has no sources
- **WHEN** 当前 notebook 下来源列表为空
- **THEN** Workspace SHALL 引导用户上传文件、从 URL 导入或使用搜索导入

#### Scenario: Sources exist but no session yet
- **WHEN** 当前 notebook 已有来源但尚无可用会话
- **THEN** Workspace SHALL 提供“一键开始会话”的明确入口

### Requirement: Workspace health status is visible and actionable
Workspace MUST 提供可见的健康入口，能展示核心依赖与可选服务的降级信息，并包含可执行的恢复建议。

#### Scenario: Optional services are degraded
- **WHEN** 可选服务（如 chroma/redis/ollama/searxng）处于 degraded/unknown
- **THEN** Workspace SHALL 呈现该状态与 recovery_hint
- **AND** 用户 SHALL 能在 UI 中一键复制/跳转到对应修复说明

### Requirement: Command palette is discoverable and includes core actions
Workspace MUST 提供可发现的命令面板（例如 Ctrl+K）并包含覆盖核心流程的最小动作集。

#### Scenario: Open command palette
- **WHEN** 用户触发 Ctrl+K（或等价入口）
- **THEN** 系统 SHALL 打开命令面板
- **AND** 至少包含：创建/切换 notebook、导入来源、开始会话、打开 Studio/Slides、打开诊断
