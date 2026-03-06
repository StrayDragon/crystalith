## Context

当前 `SLIDES` 工作流几乎完全内置在 core：

- 后端在 `features/studio/slides/*` 中内置 outline / markdown 生成逻辑与默认配置。
- `/v1/workspace/tools` 仍硬编码追加 `SLIDES` tool，且 `GET /v1/workspace/tools/slides/config` 作为独立配置端点长期存在。
- 前端 `SlidesStudioDialog` 直接依赖 slides 专用端点与一组硬编码字段，命令面板、onboarding 与 Studio 入口也默认假设 slides 一定可用。

这与当前仓库已经建立的插件方向不一致：输出类型、解析器、网页提取器都已经拆为官方插件，slides 反而成为“剩余的大块内置能力”。同时，slides 的复杂度高于现有 `OutputTypePlugin`：它不是单次结构化生成，而是包含 draft 生命周期、outline/markdown 两段生成、主题/frontmatter/预览契约、以及前端专用交互。

本变更的目标不是“把现有 core slides 包一层薄插件外壳”，而是把 slides 真正抽成一类独立插件接口，并顺手提供一个足够复杂的官方参考插件，作为后续自定义 slides 引擎/模板体系的样板。

约束：

- 仍保留 `SLIDES` 这一业务能力与现有 draft / SSE 主链路，避免数据库输出类型与用户心智一起大改。
- 不做旧路径兼容：不保留 slides 专用 config 端点，不保留“core 默认内置 slides”的降级行为。
- v1 只支持“单个 active slides workflow plugin”支撑 `SLIDES` tool；不在同一轮里实现多插件并行切换 UI。

## Goals / Non-Goals

**Goals:**

- 定义 `SlidesWorkflowPlugin`（或等价接口），把 slides 的生成、默认配置、预览契约与前端声明从 core 抽离。
- 让 `/v1/workspace/tools` 成为 slides 可用性与配置的单一权威来源；移除 slides 专用配置端点。
- 让前端所有 slides 入口都随 tools/diagnostics 动态变化，而不是默认可用。
- 提供一个官方参考插件 `crystalith-slides-slidev`（plugin id `slides-slidev`），作为复杂插件示例。
- 为“未安装 / 被禁用 / 版本不兼容 / 多插件冲突未选定”建立稳定、可执行的诊断语义。

**Non-Goals:**

- v1 不做插件市场、远程下载、签名校验或动态前端远程模块加载。
- v1 不支持同一 workspace / 同一 draft 在多个 slides workflow plugin 之间热切换。
- v1 不保留 `GET /v1/workspace/tools/slides/config` 的兼容读路径。
- v1 不引入新的数据库 `OutputType` 枚举值；`SLIDES` 仍保持单一业务类型。

## Decisions

### 1. 引入独立的 `SlidesWorkflowPlugin`，而不是复用 `OutputTypePlugin`

`OutputTypePlugin` 适合“单次生成 + render/config 描述”的结构化输出，不适合 slides 这种双阶段生成、带 preview/frontmatter/theme 契约的 workflow。为避免把 `OutputTypePlugin` 演化成过度宽泛的接口，本变更新增与其并列的一类插件：`SlidesWorkflowPlugin`。

宿主与插件的职责边界：

- 宿主（core）继续持有：draft CRUD、SSE 路由、数据库持久化、输出同步、文件落盘、统一错误信封、统一 observability。
- 插件持有：default prompt、rich config schema + defaults、outline/markdown 生成实现、engine metadata、preview descriptor、frontend bundle 声明。

替代方案：

- **扩展 `OutputTypePlugin` 到能覆盖 slides**：会把“简单输出插件”和“复杂 workflow 插件”揉进一个接口，导致现有输出插件模型失焦。
- **保留 core slides，仅以插件提供 metadata**：不能真正实现解耦，也无法给外部开发者提供可参考的复杂插件样板。

### 2. `SLIDES` 仍是单一业务 tool，但其 availability 完全由 active plugin 决定

业务层仍只暴露一个 `SLIDES` tool，避免数据库与前端导航模型同时改造；但它不再是 core 内置，而是由“当前生效的 slides workflow plugin”提供。

选择规则：

1. 若 `slides.default_plugin` 已配置，则必须选择该 plugin id；未加载/不兼容时直接视为 unavailable。
2. 若未配置且仅发现一个兼容的 slides plugin，则自动选中它。
3. 若未配置且发现 0 个或超过 1 个兼容插件，则 `SLIDES` 不可用，并返回结构化诊断（missing / ambiguous）。

这个规则允许未来存在多个 slides 引擎插件，同时保持当前 `SLIDES` tool 的单入口语义。

### 3. 以一次性升级方式收敛到统一 tool config 契约

slides 的配置项远多于当前 `PluginConfigSchema` 能表达的字段，因此本变更不再沿用“output plugin 的窄 schema + slides 独立端点”的双轨模式，而是直接升级为更通用的 `ToolConfigSchema`（命名可在实现时调整，但语义必须统一）：

- 所有 tool 的配置都通过 `WorkspaceTool.config_schema` 暴露。
- `SLIDES` 的 config_schema 必须能表达 defaults、quantity / audience / structure / tone / language / density / theme / frontmatter，以及 active plugin 的 engine / preview 相关元数据。
- 前端读取 `/v1/workspace/tools` 即可完成 slides 可用性判断与配置渲染；不再请求 slides 专用 config 端点。

替代方案：

- **保留 `/v1/workspace/tools/slides/config`**：继续制造特例，前端无法真正做到“只认 tools contract”。
- **让 slides 插件返回松散 JSON**：实现容易，但会削弱共享类型和测试约束，不适合仓库当前的 typed pattern。

### 4. 官方参考插件直接承接现有 Slidev 能力，并故意做成“复杂样板”

官方参考插件建议命名：

- package: `backend/py/plugins/crystalith-slides-slidev`
- plugin id: `slides-slidev`

它不是一个最小 Hello World 插件，而是要覆盖：

- outline / markdown 双阶段生成；
- 当前 slides 配置全集（quantity / audience / structure / tone / language / density / theme_preset / frontmatter）；
- Slidev 预览契约与前端 bundle 声明；
- `SLIDES` 输出渲染所需的元数据；
- README / 安装方式 / 入口点注册，作为外部开发者的参考模板。

这样做的原因是：slides workflow 正好是仓库里最接近“真实复杂插件”的例子，比当前输出类插件更能说明如何组织共享 schema、生成逻辑、前端 bundle 与诊断语义。

### 5. UI 入口全部以 tools / diagnostics 为准

不仅 `SlidesStudioDialog` 本身要改，命令面板、onboarding、Studio tool grid 也都不能再假定 slides 总可用。统一规则：

- `tools` 里有 `SLIDES`：显示可用入口。
- `tools` 里没有 `SLIDES`，但 `diagnostics` / official catalog 给出 slides 相关 hint：显示“不可用 + 恢复指引”入口。
- 不再存在“即使后端没有能力，前端仍显示可点开的 slides 按钮”。

### 6. 一次性切换，不保留旧实现兼容层

根据本仓库的重构约束，本变更直接移除旧写法：

- 删除 `/v1/workspace/tools/slides/config`。
- 删除 `/v1/workspace/tools` 中对 built-in slides 的硬编码注入。
- 删除前端对 slides 专用 config API 的依赖。
- 将 core 中 Slidev 特定默认值与提示迁移到官方 reference plugin。

这样能避免长期存在“新旧两套 slides 协议”并行。

## Risks / Trade-offs

- [`ToolConfigSchema` 升级会波及现有 output plugins] → 在同一轮内统一迁移所有已有 output plugin 与前端类型，避免长期维护双模型。
- [单一 active plugin 约束减少了多引擎同时暴露的灵活性] → 先保证宿主协议与诊断清晰，后续如需“多引擎并列显示”再扩展 tool 模型。
- [将生成逻辑迁出 core 会带来较大搬迁成本] → 先保持 core 持有 draft / SSE / persistence，只迁移 engine-specific 逻辑，降低重构面。
- [前端入口从“默认显示”改为“按能力显示”会改变用户路径] → 通过 diagnostics / onboarding / command palette 给出明确的安装与恢复提示。

## Migration Plan

1. 在 shared plugin contracts 中新增 `SlidesWorkflowPlugin` 与相关 schema/descriptor 类型，并把官方 plugin catalog 扩展到 `slides-*`。
2. 在 `backend/py/plugins/` 新建 `crystalith-slides-slidev`，把现有 Slidev-specific 默认配置与生成逻辑迁入插件。
3. 在 core 中将 slides draft / SSE 路由改为委托 active plugin；若无 active plugin，则返回稳定 unavailable 诊断。
4. 将 `WorkspaceTool.config_schema` 升级为统一 tool 配置模型，并删除 `/v1/workspace/tools/slides/config`。
5. 前端改为完全依赖 `/v1/workspace/tools` + diagnostics 驱动 slides 入口、配置与错误提示；命令面板 / onboarding / dialog 统一更新。
6. 更新 OpenAPI、前端 generated client、配置 schema、README / plugin docs / self-host 指南。

回滚策略：若上线后发现严重问题，可整体回滚到“slides 仍在 core 的前一版本”；本变更内部不设计双路径回滚开关。

## Open Questions

- `ToolConfigSchema` 的最终命名与建模范围，是做成 union，还是直接升级为更通用的单模型？
- preview descriptor 是否只需要描述“当前活动预览目标”，还是需要支持多个 preview mode（内嵌 / 外链 / 导出）？
- v1 是否需要在 diagnostics 中明确区分“plugin 未安装”和“plugin 已安装但未被选中为 default”？
