# language: zh-CN
# capability: web-extractor-plugins
# purpose: 定义网页提取器插件化契约：实现来源、可用性清单、选择与降级、全局/Notebook 级启用策略，以及结构化错误模型，使 URL fetch 能在 core-only 与官方插件套件形态下保持可预测与可诊断。
# scope: src/, tests/

功能: web-extractor-plugins

  @req:r55 @human
  场景: Web extractors are provided by plugins
    - 网页提取器实现 MUST 由插件提供，core MUST 仅保留提取编排框架（fallback/retry/代理/SSRF 校验）与稳定的数据模型；当某提取器插件未安装或被禁用时，core MUST NOT 视为“内置可用”。

  @req:r113 @human
  场景: Extractor selection supports preference and controlled fallback
    - 系统 MUST 支持对单次 fetch 指定 `preferredExtractor`，并 MUST 支持按配置定义的 fallback order；fallback MUST 仅在显式开启时发生，且每次尝试都必须可观测（日志/诊断信息）。

  @req:r150 @human
  场景: Extractor availability is checkable and listable
    - 系统 MUST 提供对外可查询的"提取器可用性清单"，包含：提取器类型、是否启用、是否可用、不可用原因与恢复提示（如适用）。

  @req:r185 @human
  场景: Extractor enablement supports global policy and per-notebook policy
    - 系统 MUST 同时支持： - **全局策略（Global Policy）**：由 `config/app.yaml` 给出每个 extractor 的默认启用状态。 - **笔记本策略（Notebook Policy）**：由 UI 通过 API 持久化到数据库（按 notebook），并允许该 notebook 选择“是否遵循全局策略”。 笔记本策略 MUST 支持一个模式字段： - `mode="inherit_global"`：该 notebook 遵循全局策略（默认） - `mode="custom"`：该 notebook 使用自定义启用集合（可与全局不同） effective enabled 的计算 MUST 为： `plugin_enabled (allowlist/denylist) ∧ (mode == inherit_global ? global_enabled : notebook_enabled)` 说明： - 插件启用（install/allowlist/denylist）是运维边界，UI MUST NOT 直接修改。 - `mode="custom"`：切换为 custom 时 MUST 允许按 notebook 显式指定各 extractor 的启用/禁用覆盖，未显式列出的 extractor 继承全局默认状态。

  @req:r217 @human
  场景: Extractor plugins provide structured errors
    - 提取器插件在失败时 MUST 抛出结构化错误（至少包含 errorCode/message，且可选包含 extractor/url），以便 core 能区分“可重试失败/不可用/配置缺失”并做出一致的降级与提示。

  @req:extractors-full-response @human
  场景: GET extractors MUST return full ExtractorsListResponse
    - GET /extractors MUST 返回完整 ExtractorsListResponse（每提取器 available/displayName/priority/requiresApiKey/recoveryHint + defaultExtractor + fallbackEnabled），MUST NOT 只返回存储的策略行

  @req:r55 @human
  场景: extractor-availability-depends-on-installed-enabled-plugins
    - 必须成立：当 运维未安装某提取器插件或在 `plugins.disabled` 中禁用它；那么 系统 SHALL 不将该提取器计为可用
    当 运维未安装某提取器插件或在 `plugins.disabled` 中禁用它
    那么 系统 SHALL 不将该提取器计为可用

  @req:r113 @human
  场景: preferred-extractor-is-attempted-first
    - 必须成立：当 用户指定 `preferredExtractor=X` 且 X 可用；那么 系统 SHALL 首先尝试 X
    当 用户指定 `preferredExtractor=X` 且 X 可用
    那么 系统 SHALL 首先尝试 X

  @req:r113 @human
  场景: no-extractors-available-produces-a-stable-failure
    - 必须成立：当 系统在当前配置与插件集合下没有任何可用提取器；那么 fetch 模式 SHALL 失败并返回稳定的错误码与恢复提示（例如“安装/启用官方 extractor 插件”）
    当 系统在当前配置与插件集合下没有任何可用提取器
    那么 fetch 模式 SHALL 失败并返回稳定的错误码与恢复提示（例如“安装/启用官方 extractor 插件”）

  @req:r150 @human
  场景: frontend-displays-extractor-diagnostics
    - 必须成立：当 前端请求提取器清单端点；那么 响应 SHALL 包含每个提取器的 enabled/available 状态
    当 前端请求提取器清单端点
    那么 响应 SHALL 包含每个提取器的 enabled/available 状态

  @req:r185 @human
  场景: user-disables-an-extractor-for-a-notebook
    - 必须成立：当 用户在 UI 中对某 notebook 关闭某 extractor；那么 后端 SHALL 持久化该覆盖并在 extractor 清单中反映 `enabled=false`
    当 用户在 UI 中对某 notebook 关闭某 extractor
    那么 后端 SHALL 持久化该覆盖并在 extractor 清单中反映 `enabled=false`

  @req:r185 @human
  场景: notebook-overrides-are-writable-via-api
    - 必须成立：当 客户端通过 `PATCH /v2/notebooks/{notebookId}/sources/extractors` 更新某 notebook 的 extractor 策略（mode 与启用/禁用覆盖）；那么 后端 SHALL 持久化该覆盖
    当 客户端通过 `PATCH /v2/notebooks/{notebookId}/sources/extractors` 更新某 notebook 的 extractor 策略（mode 与启用/禁用覆盖）
    那么 后端 SHALL 持久化该覆盖

  @req:r217 @human
  场景: retryable-extractor-errors-are-detected
    - 必须成立：当 提取器因网络/服务不可用导致失败；那么 系统 SHALL 能将该错误判定为可重试并按策略重试
    当 提取器因网络/服务不可用导致失败
    那么 系统 SHALL 能将该错误判定为可重试并按策略重试

  @req:extractors-full-response @human
  场景: client-lists-extractors
    - 必须成立：假如 客户端请求 GET /extractors；当 构建响应；那么 系统 SHALL 返回每提取器的 available/displayName/priority/requiresApiKey/recoveryHint 字段
    假如 客户端请求 GET /extractors
    当 构建响应
    那么 系统 SHALL 返回每提取器的 available/displayName/priority/requiresApiKey/recoveryHint 字段
