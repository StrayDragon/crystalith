# frontend-bundle-loader-resilience-and-fallback-ux 规范增量

## ADDED Requirements

### Requirement: Frontend Bundle Loader Failures MUST Map to Stable Error Classes
系统 MUST 将 frontend bundle loader 失败映射到稳定错误类，而不是只在控制台输出不一致异常。

#### Scenario: 某个 output renderer bundle 加载失败
- **WHEN** loader 遇到缺描述符、export 不兼容、api_version 不支持或 import 失败
- **THEN** 系统 SHALL 产出稳定的错误分类
- **AND** diagnostics/UI SHALL 能引用同一分类解释问题

### Requirement: Bundle Fallback UX MUST Be Visible but Non-disruptive
系统 MUST 为 bundle 失败提供克制但明确的 fallback UX，而不是静默退回 generic/raw renderer。

#### Scenario: 生产环境中 renderer bundle 不可用
- **WHEN** 系统需要回退到 generic 或 raw renderer
- **THEN** 用户 SHALL 仍能继续使用内容
- **AND** 系统 SHALL 在 diagnostics 或轻提示中说明发生了何种 fallback 与如何重试
