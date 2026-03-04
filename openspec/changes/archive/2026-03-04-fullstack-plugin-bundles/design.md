## Context

Crystalith 已具备后端插件系统（Python entry points：`crystalith.plugins`），并在 `OutputTypePlugin` 上提供 `schema/default_prompt/metadata/render_descriptor/config_schema` 等扩展点，用于结构化输出与声明式渲染。

但“交互式输出 UI”（例如测验运行器、思维导图交互）目前依赖前端硬编码的输出渲染插件注册表，导致后端插件无法携带对应的前端 UI，无法形成可交付的“前后端一体插件”。

本变更引入一个明确的联动契约：后端通过稳定结构声明前端 bundle，前端通过内置 registry 在构建产物内定位并 lazy-load 渲染器，失败则回退到通用渲染器或 Raw JSON。

## Goals / Non-Goals

**Goals:**
- 让 `OutputTypePlugin` 能可选声明 `frontend_bundle`（稳定类型、可版本化）。
- 后端通过 `/v1/workspace/tools` 暴露该声明，前端无需硬编码 output-type → renderer 的映射。
- 前端支持 `builtin` bundle（构建期集成，运行期开关）并提供可预测的渲染优先级与失败回退。
- 明确版本协商：前端仅加载其支持的 `frontend_bundle.api_version`。

**Non-Goals:**
- v1 不支持运行期远程加载第三方 ESM/iframe（不引入签名/CSP/沙箱/下载器）。
- v1 不支持插件新增路由/菜单/页面级模块（micro-frontend）；仅覆盖输出渲染场景。
- 不改变后端插件发现机制（仍为 entry points），不引入新的插件管理端点（先复用 tools API）。

## Decisions

1) **引入 `FrontendBundleDescriptor` 并将其作为共享类型导出**
- 选择在 `crystalith.shared.plugins` 中提供稳定、可导入的 pydantic model。
- 理由：外部插件需要引用该类型；与 render/config 描述符同属“插件对前端的声明”。

2) **v1 仅支持 `kind="builtin"`**
- 前端 bundle 必须存在于前端构建产物中，通过本地 registry（id → loader）确定性加载。
- 理由：最小化安全与发布复杂度，为官方插件拆分提供可用的最小闭环。

3) **通过 `/v1/workspace/tools` 暴露 `frontend_bundle`**
- 理由：前端现有流程已经依赖 tools 列表装配 UI（render_descriptor/config_schema），新增字段最小侵入。
- 取舍：不提供“全量插件目录”或诊断端点；诊断交给既有 plugin checker 脚本与日志。

4) **渲染优先级固定为 `frontend_bundle > GenericOutputRenderer > Raw JSON`**
- 理由：交互式渲染器应覆盖声明式渲染；但必须始终有稳定回退以避免 UI 崩溃。

5) **版本字段分离**
- `OutputTypePlugin.api_version` 与 `frontend_bundle.api_version` 独立 gate。
- 理由：后端插件 API 与前端渲染入口的演进速度不同；分离可降低耦合与升级冲突。

## Risks / Trade-offs

- [动态 import 增加复杂度] → 通过确定性 registry、明确的错误回退路径与单元测试覆盖降低风险。
- [前后端版本漂移导致 renderer 不可用] → 通过 `frontend_bundle.api_version` 显式 gate，并在不兼容时回退到通用渲染器。
- [未来引入远程加载的安全边界] → v1 明确不支持；后续如需第三方生态再单独提案并引入签名/CSP/沙箱策略。

## Migration Plan

- 第 1 步：后端新增 `frontend_bundle` 可选字段并发布（旧前端将忽略未知字段）。
- 第 2 步：前端实现 builtin registry 与加载逻辑；当后端返回 `frontend_bundle` 时优先使用专用 renderer。
- 回滚策略：若前端 bundle 加载或渲染出现问题，前端会自动回退到 `GenericOutputRenderer` 或 Raw JSON；后端可暂时不下发 `frontend_bundle`（或禁用对应插件）以快速止血。
