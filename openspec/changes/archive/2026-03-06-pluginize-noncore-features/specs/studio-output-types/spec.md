# studio-output-types Specification (Delta)

## ADDED Requirements

### Requirement: Studio output types are plugin-driven and discoverable
Studio 的工具输出类型集合 MUST 由 `/v1/workspace/tools` 返回的动态列表驱动；客户端 MUST NOT 依赖硬编码枚举来假设某输出类型必然存在。

说明：
- tools 列表的来源可以是 core 内置能力或插件能力
- 在本变更范围内，除 `SLIDES`（暂保留 core 内置）外，其余工具输出类型（FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING）MUST 由官方插件提供

#### Scenario: Output type options are derived from tools API
- **WHEN** 客户端加载 Studio 的输出类型选择器
- **THEN** 可选项 SHALL 来自 `/v1/workspace/tools` 返回的 tools 列表
- **AND** 当某输出类型插件未安装/未启用时，该类型 SHALL 不作为可选项（或明确展示为不可用）

### Requirement: Missing capabilities are explained to the user
当某输出类型不可用（插件缺失/禁用/加载失败）时，客户端 MUST 能呈现可执行的恢复提示（例如安装/启用对应官方插件），以避免“功能消失但原因不明”。

#### Scenario: UI shows an actionable hint for missing tool
- **WHEN** tools API 返回结构化诊断信息指出某输出类型插件不可用
- **THEN** UI SHALL 显示该能力不可用原因
- **AND** SHALL 显示可执行的恢复步骤（例如需要启用/安装的插件 id）
