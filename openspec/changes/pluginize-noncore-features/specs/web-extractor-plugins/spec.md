## ADDED Requirements

### Requirement: Web extractors are provided by plugins
网页提取器实现 MUST 由插件提供，core MUST 仅保留提取编排框架（fallback/retry/代理/SSRF 校验）与稳定的数据模型；当某提取器插件未安装或被禁用时，core MUST NOT 视为“内置可用”。

#### Scenario: Extractor availability depends on installed/enabled plugins
- **WHEN** 运维未安装某提取器插件或在 `plugins.disabled` 中禁用它
- **THEN** 系统 SHALL 不将该提取器计为可用
- **AND** 若请求显式选择该提取器，系统 SHALL 返回可诊断的错误或按策略回退

### Requirement: Extractor selection supports preference and controlled fallback
系统 MUST 支持对单次 fetch 指定 `preferred_extractor`，并 MUST 支持按配置定义的 fallback order；fallback MUST 仅在显式开启时发生，且每次尝试都必须可观测（日志/诊断信息）。

#### Scenario: Preferred extractor is attempted first
- **WHEN** 用户指定 `preferred_extractor=X` 且 X 可用
- **THEN** 系统 SHALL 首先尝试 X
- **AND** 仅当 X 失败且 fallback 启用时，才按 fallback order 继续尝试

#### Scenario: No extractors available produces a stable failure
- **WHEN** 系统在当前配置与插件集合下没有任何可用提取器
- **THEN** fetch 模式 SHALL 失败并返回稳定的错误码与恢复提示（例如“安装/启用官方 extractor 插件”）

### Requirement: Extractor availability is checkable and listable
系统 MUST 提供对外可查询的“提取器可用性清单”，包含：提取器类型、是否启用、是否可用、不可用原因与恢复提示（如适用）。

#### Scenario: Frontend displays extractor diagnostics
- **WHEN** 前端请求提取器清单端点
- **THEN** 响应 SHALL 包含每个提取器的 enabled/available 状态
- **AND** 当某提取器不可用时 SHALL 包含可直接呈现给用户的恢复提示

### Requirement: Extractor enablement supports global policy and per-notebook policy
系统 MUST 同时支持：

- **全局策略（Global Policy）**：由 `config/app.yaml` 给出每个 extractor 的默认启用状态。
- **笔记本策略（Notebook Policy）**：由 UI 通过 API 持久化到数据库（按 notebook），并允许该 notebook 选择“是否遵循全局策略”。

笔记本策略 MUST 支持一个模式字段：
- `mode="inherit_global"`：该 notebook 遵循全局策略（默认）
- `mode="custom"`：该 notebook 使用自定义启用集合（可与全局不同）

effective enabled 的计算 MUST 为：
`plugin_enabled (allowlist/denylist) ∧ (mode == inherit_global ? global_enabled : notebook_enabled)`

说明：
- 插件启用（install/allowlist/denylist）是运维边界，UI MUST NOT 直接修改。
- `mode="custom"` 仅表示“不遵循全局启用集合”，但仍 MUST 受插件启用门禁与 SSRF/安全策略等约束。
- 当 notebook 从 `inherit_global` 切换为 `custom` 时，系统 SHOULD 用当前全局策略初始化该 notebook 的自定义启用集合，以提供可预期的默认行为。

#### Scenario: User disables an extractor for a notebook
- **WHEN** 用户在 UI 中对某 notebook 关闭某 extractor
- **THEN** 后端 SHALL 持久化该覆盖并在 extractor 清单中反映 `enabled=false`
- **AND** fetch 模式在选择/回退时 SHALL 不再使用该 extractor

#### Scenario: Notebook overrides are writable via API
- **WHEN** 客户端通过 `PATCH /v1/notebooks/{notebook_id}/sources/extractors` 更新某 notebook 的 extractor 策略（mode 与启用/禁用覆盖）
- **THEN** 后端 SHALL 持久化该覆盖
- **AND** 后续 `GET .../sources/extractors` 响应 SHALL 反映最新 effective enabled 状态

### Requirement: Extractor plugins provide structured errors
提取器插件在失败时 MUST 抛出结构化错误（至少包含 error_code/message，且可选包含 extractor/url），以便 core 能区分“可重试失败/不可用/配置缺失”并做出一致的降级与提示。

#### Scenario: Retryable extractor errors are detected
- **WHEN** 提取器因网络/服务不可用导致失败
- **THEN** 系统 SHALL 能将该错误判定为可重试并按策略重试
- **AND** 超出重试后 SHALL 返回稳定错误码与恢复提示
