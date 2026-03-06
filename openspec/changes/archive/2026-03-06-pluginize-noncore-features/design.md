## Context

Crystalith 已具备后端插件系统（Python entry points：`crystalith.plugins`），并在 `PluginRegistry` 中支持 `AIProviderPlugin` / `ParserPlugin` / `OutputTypePlugin` 的发现、兼容性门禁与结构化诊断信息。

但当前仍有大量“非系统核心”的能力内置在 core 包中：

- Studio 工具输出类型（FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING）的 schema / prompt / config_schema / 前端 bundle 映射仍主要由 core 代码硬编码（例如 `/v1/workspace/tools` 仍从 `OutputType` 枚举元信息构建固定工具集）。
- 文档解析器仍以 built-in 实现为主（PDF/HTML/音视频），且 `ParserFactory` 选择顺序为“built-in 优先，插件兜底”，导致 core 依赖膨胀且难以形成可选装能力矩阵。
- 网页提取器仍以内置实现 + 配置开关装配（trafilatura/jina/firecrawl/browserless），目前缺少与 plugins 体系一致的“按插件提供实现、按配置启用、可诊断缺失”的装配方式。

基于前置变更 `fullstack-plugin-bundles`（插件可声明前端 UI bundle），本变更将上述非核心能力拆分为**官方插件套件**，让 core 收敛为最小可用框架，并以“安装/启用插件”作为扩展能力的唯一入口。

## Goals / Non-Goals

**Goals:**
- 将“工具输出类型”（FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING）的 schema/prompt/config_schema/frontend_bundle/render_descriptor 从 core 移出，迁移到官方 `OutputTypePlugin` 套件，并让 `/v1/workspace/tools` 以“可用能力”构建动态工具集（并提供结构化诊断）。
- 将 PDF/HTML/音视频等重依赖解析器迁移为官方 `ParserPlugin`，core 仅保留最小 ingestion（txt/md/markdown/csv）。
- 将网页提取器迁移为插件化装配：core 仅保留提取编排框架与降级语义，具体 extractor 由插件提供并按配置启用；缺失/禁用/不可用必须可诊断。
- 定义官方插件 monorepo 组织方式、命名/版本策略与默认启用策略，并为 self-host 提供明确的安装/迁移路径。

**Non-Goals:**
- v1 不引入插件市场、下载/安装/签名校验、远程执行（iframe/ESM）或微前端路由扩展。
- v1 不解决“插件新增全新 OutputType 枚举值”的数据库迁移问题（仍以覆盖/提供既有 OutputType 值为主）。
- 本变更不插件化 `SLIDES` 工作流（slides endpoints + `GET /v1/workspace/tools/slides/config` 暂保持内置）；相关插件化另立变更 `pluginize-slides-workflow`。
- 不追求对旧“core 内置枚举工具集”的兼容：本变更以一次性升级为目标，旧写法将被整体替换为插件驱动写法。

## Decisions

1) **以“官方插件套件”承载所有非核心能力**
- 约定在 `backend/py/plugins/*`（或等价目录）组织官方插件包；`backend/py/examples/*` 继续仅作为示例。
- 理由：将重依赖与实现代码下沉到可选安装包，core 依赖收敛并形成清晰的能力矩阵。

2) **`/v1/workspace/tools` 返回“仅可用 tools + 诊断信息”**
- `tools[]` 仅返回当前可用的工具项（可用 = 已启用且兼容的插件能力 + 必要的 core 内置能力）。
- `SLIDES` 暂作为 core 内置 tool 保留在列表中（本变更不拆分其工作流；后续见 `pluginize-slides-workflow`）。
- tools 响应新增 `diagnostics` 字段，至少包含插件加载报告（loaded/skipped + skip detail），并为“能力缺失”提供可执行恢复提示（例如需要安装/启用的官方插件 id）。
- 理由：前端以 tools 作为唯一权威来源，且必须能解释“为什么没有某功能/如何恢复”。

3) **工具输出类型的生成门禁：无插件则拒绝**
- 对 FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING 等工具输出类型，生成链路 MUST 要求对应 `OutputTypePlugin` 存在且可用；缺失时返回稳定错误信封与可执行 `recovery_hint`（例如安装/启用 `output-faq`）。
- 理由：core 不再隐式携带非核心 schema/prompt，同时让失败可诊断、可恢复。

4) **输出生成的 schema/prompt 由插件提供，core 仅保留最小默认集合**
- 输出生成图在运行时优先使用 `OutputTypePlugin.schema/default_prompt`；core 仅保留 paragraph/bullets/structured 等最小输出类型的内置 schema 以保证 core-only 可用。
- 理由：把“工具输出”从 core 彻底拆出，同时保留最小研究工作流的可用性。

5) **解析器选择与支持矩阵以插件为中心（含冲突裁决）**
- `ParserFactory` 的匹配顺序调整为“插件优先、core 最小兜底”（或等价的统一策略），并将 PDF/HTML/音视频解析器迁移为官方 `ParserPlugin`。
- core-only 支持矩阵固定为：txt/md/markdown/csv；其他格式未安装插件时必须稳定返回 415 并提供可诊断恢复提示。
- 当多个插件 parser 同时命中同一文件类型时，宿主使用确定性规则裁决：优先使用配置中的插件加载顺序（`plugins.load_order`），否则按 `plugin_id` 排序；并将最终生效的 `plugin_id` 写入诊断与来源元数据以便排障。

6) **引入 `WebExtractorPlugin` 并把 extractor 装配纳入 PluginRegistry**
- 为网页提取器新增插件接口（extractor id/type、`create_extractor(...)`、`is_available()`、资源释放等），由 `PluginRegistry` 发现与注册；提取编排继续由 core 的 `ExtractorFactory` 负责（fallback order / retry / proxy / SSRF 逐跳重定向重验）。
- 理由：统一“可选能力”的装配模型（发现/启用/诊断），并把 trafilatura/firecrawl/playwright 等重依赖从 core 拆出。

7) **提取器启用状态：全局策略 + notebook 策略（可选择是否遵循）**
- 全局策略（Global Policy）由 `config/app.yaml` 给出每个 extractor 的默认启用状态。
- notebook 策略（Notebook Policy）由 UI 持久化（存数据库），并包含 `mode=inherit_global|custom`：
  - `inherit_global`：该 notebook 遵循全局策略（默认）
  - `custom`：该 notebook 使用自定义启用集合（可与全局不同）
- effective enabled = 插件启用策略（allowlist/denylist） ∧ (`inherit_global ? global_enabled : notebook_enabled`)
- 理由：运维控制“装什么/启不启插件”，全局策略提供默认；用户可在 notebook 维度选择是否遵循并进行细粒度调整，且不越过插件/安全门禁边界。

8) **默认启用策略：已安装即默认启用，可用 allowlist/denylist 精细控制**
- 沿用现有 `plugins.enabled`（allowlist）与 `plugins.disabled`（denylist）语义：默认加载所有已安装插件；当配置了 allowlist 时仅加载白名单。
- 理由：官方插件安装后开箱即用；自托管可用 allowlist 实现“最小可用 + 精选增强”的 profile。

## Risks / Trade-offs

- [工具集从固定枚举变为动态集合导致前端假设失效] → tools API 提供稳定诊断信息；前端 UI 以“动态列表 + disabled 提示”重构，避免 hardcode。
- [拆包导致安装复杂度上升（依赖分散、版本漂移）] → 约定官方插件命名/版本策略；提供“core-only / official-full”安装方式与验收脚本。
- [Extractor/Parser 插件缺失导致用户体验退化] → 对 415/503 等失败提供明确 error_code 与 recovery_hint；在 UI 上提供可执行的迁移/安装指引。
- [插件冲突与 last-wins 隐蔽覆盖] → 在诊断信息中输出“最终生效插件 id/entry_point”；为官方插件约定唯一 key，避免冲突。

## Migration Plan

1. 后端引入官方插件包（输出类型/解析器/提取器），并将 core 中对应实现与依赖逐步迁移下沉。
2. 改造 `/v1/workspace/tools` 为“仅可用 tools + diagnostics”，并在响应中携带结构化诊断信息（用于 UI 提示与迁移）。
3. 改造输出生成图与解析器/提取器装配：优先插件、core 最小兜底；对工具输出类型缺插件时返回可执行的恢复提示（不再隐式回退 core schema）。
4. 更新前端：从 tools API 动态渲染工具与输出渲染器；当能力不可用时展示“未安装/未启用/依赖缺失”提示。
5. 清理 core 依赖：将 pypdf/trafilatura/firecrawl-py/playwright/bs4/lxml 等移出 core 依赖，迁移到对应官方插件包。

回滚策略：通过禁用官方插件（denylist）或回退安装包到 core-only，系统仍能以最小能力启动；tools API 与渲染链路保持安全降级。

## Open Questions

- `ExtractorType` / `OutputType` 等是否需要在未来从 enum 收敛为开放字符串集合，以支持第三方插件新增类型？
- 官方插件的发布策略：是否与 core 版本强绑定（同版本号）还是独立语义化版本？对自托管升级路径的影响如何最小化？
