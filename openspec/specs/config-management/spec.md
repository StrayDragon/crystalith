# config-management Specification

## Purpose
TBD - created by archiving change add-research-workspace. Update Purpose after archive.
## Requirements
### Requirement: YAML 配置加载与校验
系统 SHALL 使用 pydantic-settings 从 YAML 配置文件加载配置，并对配置进行校验（不从环境变量读取配置）。

#### Scenario: 加载有效配置
- **WHEN** 提供符合 Schema 的 YAML 配置
- **THEN** 系统成功加载并使用该配置

#### Scenario: 加载无效配置
- **WHEN** YAML 配置缺失必填字段或类型不匹配
- **THEN** 系统给出清晰的校验错误信息

### Requirement: 配置 Schema 生成
系统 SHALL 生成配置的 JSON Schema，用于 YAML 语言服务校验与补全。

#### Scenario: 生成 Schema
- **WHEN** 调用配置管理器的 Schema 生成接口
- **THEN** 生成并保存 JSON Schema 文件（本地路径，例如 `config/schema.json`）

### Requirement: YAML 语言服务提示
系统 SHALL 提供可直接用于 YAML 语言服务的 Schema 引用字符串。

#### Scenario: 使用 Schema 注释
- **WHEN** 用户在 YAML 头部添加 `# yaml-language-server: $schema=<URL>`
- **THEN** 编辑器可基于生成的 Schema 提供校验与补全

