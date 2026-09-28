# language: zh-CN
# capability: web-extractor-plugins
# purpose: 定义网页提取器插件化契约：实现来源、可用性清单、选择与降级、全局/Notebook 级启用策略，以及结构化错误模型，使 URL fetch 能在 core-only 与官方插件套件形态下保持可预测与可诊断。
# scope: apps/server/src/shared/extraction/, apps/server/src/features/sources/, apps/server/src/plugins/builtin/

功能: web-extractor-plugins

  @req:r331
  规则: Web extractors are provided by plugins
    网页提取器实现 MUST 由插件提供，core MUST 仅保留提取编排框架（fallback/retry/代理/SSRF 校验）与稳定的数据模型；当某提取器插件未安装或被禁用时，core MUST NOT 视为“内置可用”。

    场景: extractors-come-from-plugin-registry
      假如 core 仅保留提取编排框架与稳定数据模型
      当 运行 apps/server/tests/plugins/registry.test.ts 的内置注册与 denylist 用例
      那么 提取器实现由插件按注册顺序提供且被 denylist 命中的插件不可用
      而且 未安装或被禁用的提取器插件不会被 core 视为内置可用
  @req:r332
  规则: Extractor selection supports preference and controlled fallback
    系统 MUST 支持对单次 fetch 指定 `preferredExtractor`，并 MUST 支持按配置定义的 fallback order；fallback MUST 仅在显式开启时发生，且每次尝试都必须可观测（日志/诊断信息）。

    场景: extractor-preference-and-observable-fallback
      假如 已注册多个可用性各异的提取器且 fallback order 来自配置
      当 运行 apps/server/tests/plugins/c117-extractor-selection.test.ts 的选择链用例
      那么 无偏好时按配置 fallback order 尝试且每次尝试可观测
      而且 偏好提取器失败时不静默穿透到其它提取器且失败尝试记录在提取错误中
  @req:r468

  规则: preferred-extractor-is-attempted-first
    用户指定 `preferredExtractor=X` 且 X 可用时，系统 SHALL 首先尝试 X。

    场景: preferred-extractor-attempted-first
      假如 用户对单次 fetch 指定 preferredExtractor=X 且 X 可用
      当 运行 apps/server/tests/plugins/c117-extractor-selection.test.ts 的偏好用例（编排层与 from-url HTTP 层）
      那么 提取尝试序列以 X 开头且成功结果记录 extractorUsed=X
      而且 HTTP 响应的 extractedBy 与编排层一致
  @req:r469

  规则: no-extractors-available-produces-a-stable-failure
    当前配置与插件集合下没有任何可用提取器时，fetch 模式 SHALL 失败并返回稳定的错误码与恢复提示（例如「安装/启用官方 extractor 插件」）。

    场景: no-available-extractor-stable-failure
      假如 配置的提取器链中没有任何可用提取器
      当 运行 apps/server/tests/plugins/c117-extractor-selection.test.ts 的稳定失败用例（编排层 extractUrl）
      那么 提取以稳定的 All extractors failed 错误终结且逐项记录链内条目
      而且 不伪造成功也不尝试链外的提取器
  @req:r333
  规则: Extractor availability is checkable and listable
    系统 MUST 提供对外可查询的"提取器可用性清单"，包含：提取器类型、是否启用、是否可用、不可用原因与恢复提示（如适用）。

    场景: extractor-availability-list-shape
      假如 对外可用性清单入口就绪
      当 运行 apps/server/tests/sources/c62-extractors-shape.test.ts 的字段形状用例
      那么 清单每项含提取器类型、是否启用、是否可用、不可用原因与恢复提示（如适用）
      而且 该清单可查询也可列举
  @req:r334
  规则: Extractor enablement supports global policy and per-notebook policy
    系统 MUST 同时支持： - **全局策略（Global Policy）**：由 `config/app.yaml` 给出每个 extractor 的默认启用状态。 - **笔记本策略（Notebook Policy）**：由 UI 通过 API 持久化到数据库（按 notebook），并允许该 notebook 选择“是否遵循全局策略”。 笔记本策略 MUST 支持一个模式字段： - `mode="inherit_global"`：该 notebook 遵循全局策略（默认） - `mode="custom"`：该 notebook 使用自定义启用集合（可与全局不同） effective enabled 的计算 MUST 为： `plugin_enabled (allowlist/denylist) ∧ (mode == inherit_global ? global_enabled : notebook_enabled)` 说明： - 插件启用（install/allowlist/denylist）是运维边界，UI MUST NOT 直接修改。 - `mode="custom"`：切换为 custom 时 MUST 允许按 notebook 显式指定各 extractor 的启用/禁用覆盖，未显式列出的 extractor 继承全局默认状态。

    场景: global-and-notebook-extractor-policy
      假如 笔记本尚未持久化提取器策略且全局启用状态来自 config 插件策略
      当 运行 apps/server/tests/plugins/c117-extractor-selection.test.ts 的策略用例（GET/PATCH /notebooks/:nid/extractors）
      那么 默认 mode 为 inherit_global 且 fallbackEnabled 为真、列表条目反映全局插件启用状态
      而且 PATCH mode=custom 与 enabledExtractors 持久化并翻转 fallbackEnabled、未知提取器名被 400 拒绝
  @req:r335
  规则: Extractor plugins provide structured errors
    提取器插件在失败时 MUST 抛出结构化错误（至少包含 errorCode/message，且可选包含 extractor/url），以便 core 能区分“可重试失败/不可用/配置缺失”并做出一致的降级与提示。

    场景: extractor-failures-are-structured
      假如 提取器插件在提取过程中失败
      当 运行 apps/server/tests/sources/c57-safety-diagnostics.test.ts 的 errorCode 用例
      那么 抛出的错误含 errorCode 与 message 字段（如 PARSE_ERROR、EMBEDDING_FAILED 分类）
      而且 core 可据此区分可重试失败/不可用/配置缺失并做一致降级与提示
  @req:r336
  规则: GET extractors MUST return full ExtractorsListResponse
    GET /extractors MUST 返回完整 ExtractorsListResponse（每提取器 available/displayName/priority/requiresApiKey/recoveryHint + defaultExtractor + fallbackEnabled），MUST NOT 只返回存储的策略行

    场景: get-extractors-returns-full-response
      假如 GET /extractors 端点就绪
      当 请求该端点并对照 c62-extractors-shape.test.ts 的 listExtractorMetadata/defaultExtractor 覆盖
      那么 响应为完整 ExtractorsListResponse（含每提取器 available/displayName/priority/requiresApiKey/recoveryHint 与 defaultExtractor、fallbackEnabled）
      而且 响应不只返回存储的策略行
  @req:r337
  规则: Extractor plugins MAY declare urlPatterns for UI hints
    提取器插件 MAY 声明可选 `urlPatterns`（regex source 字符串数组）；系统 SHALL 在 extractors 元数据响应中透出该字段；`urlPatterns` 仅作 UI 预选提示，MUST NOT 改变提取执行链的 fall-through 语义（见 r331）。

    场景: urlpatterns-hint-only
      假如 提取器插件声明了 urlPatterns 且目标 URL 命中该模式
      当 运行 apps/server/tests/plugins/c117-extractor-selection.test.ts 的 urlPatterns 用例
      那么 执行链仍按配置顺序选择提取器而不优先命中模式的插件
      而且 extractors 元数据响应透出 urlPatterns 字段
