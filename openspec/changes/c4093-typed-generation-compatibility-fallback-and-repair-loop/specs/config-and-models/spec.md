# config-and-models 规范增量

## ADDED Requirements

### Requirement: Configured Models MUST Expose Machine-Readable Capability Profiles
系统 MUST 让配置中的模型暴露可机器读取的 capability profile，以支持 generation preflight 和兼容性解释。

#### Scenario: 系统加载模型配置
- **WHEN** 某个模型被配置为可用于 generation
- **THEN** 系统 SHALL 为其提供可消费的 capability profile
- **AND** generation preflight SHALL 能读取这些 profile 做兼容性判断
