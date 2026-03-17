# dev-diagnostics-workbench 规范增量

## ADDED Requirements

### Requirement: Diagnostics Entry Is Aggregated and Guarded
系统 MUST 提供受保护的 diagnostics 入口，用于聚合系统状态与最近动作线索，而不是要求用户手动翻找分散端点。

#### Scenario: 开发者查看 diagnostics 概览
- **WHEN** 开发者打开 diagnostics workbench
- **THEN** 系统 SHALL 返回配置摘要、optional services 状态、queue/limiter 状态、cache 摘要、plugin health 与最近 run 摘要
- **AND** 该入口 SHALL 默认仅在允许的 profile 或权限下可见

### Requirement: Diagnostics Export Pack Is Redacted and Stable
系统 MUST 提供可导出的 diagnostics export pack，并对格式稳定性、默认脱敏与体积预算给出明确约束。

#### Scenario: 导出可分享诊断包
- **WHEN** 用户在 diagnostics workbench 触发导出
- **THEN** 系统 SHALL 返回结构稳定、默认脱敏的 export pack
- **AND** export pack SHALL 不包含 secret 明文或大段 prompt/source 正文

### Requirement: Timings Breakdown Is Queryable
系统 MUST 为 run 或等价动作提供可查询的阶段耗时摘要，并支持 queue/wait 等等待时间语义。

#### Scenario: 查看一次运行的阶段耗时
- **WHEN** 用户查看某次 run 的 diagnostics 详情
- **THEN** 系统 SHALL 返回标准化阶段耗时字段
- **AND** SHALL 区分执行时间与等待时间

### Requirement: Diagnostics UI Supports Timeline Navigation
diagnostics UI MUST 提供最小时间线交互，使用户能定位慢点、复制关联标识并跳转到对应诊断上下文。

#### Scenario: 点击阶段查看上下文
- **WHEN** 用户在 perf timeline 中点击某个阶段
- **THEN** UI SHALL 展示该阶段的关键信息或复制/跳转入口
- **AND** 不要求用户先打开原始日志

### Requirement: Runtime Memory Trends Are Observable
系统 MUST 暴露前后端关键缓存、buffer 或内存预算的趋势摘要，并在阈值触发时给出恢复动作。

#### Scenario: 内存趋势触发恢复提示
- **WHEN** 某项内存指标持续上升并超过阈值
- **THEN** diagnostics 输出 SHALL 给出趋势提示
- **AND** SHALL 提供至少一个可执行恢复动作或排障建议
