## ADDED Requirements

### Requirement: Workspace localization is centralized and locale-ready (zh-CN only)
Workspace MUST 将关键路径的用户可见文案集中管理（稳定 message key + `t()` 等价接口），并默认使用 `zh-CN` 文案。核心发行版不要求提供语言切换入口与多语言内置翻译，但结构 SHOULD 保持可扩展以支持社区后续新增 locale。

#### Scenario: Default locale is zh-CN without a language switcher
- **WHEN** 用户进入 Workspace 的关键路径
- **THEN** 系统 SHALL 使用 `zh-CN` 文案渲染 UI
- **AND** UI 不要求提供语言切换入口

#### Scenario: Critical-path copy is not hardcoded in components
- **WHEN** 开发者为关键路径新增/修改用户可见文案
- **THEN** 文案 SHOULD 通过 message key + 字典集中管理，而不是在组件中散落硬编码字符串
