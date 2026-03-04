# fullstack-plugin-bundles Specification

## Purpose

定义“前后端联动插件 bundle”的契约：后端如何声明可选的前端渲染 bundle，前端如何基于声明进行版本协商、加载与失败回退，以保证插件能以一体化方式交付交互式 UI 能力。

## Non-goals

- v1 不支持从远程 URL 动态执行第三方代码（ESM/iframe 等）；仅支持构建期集成的 `builtin` bundle。
- 不定义插件市场、下载/安装、签名验证、CSP/沙箱等分发与安全体系（后续能力）。

## ADDED Requirements

### Requirement: Tools API can advertise optional frontend bundles
系统 MUST 在 `/v1/workspace/tools` 的 tool 对象上支持可选字段 `frontend_bundle`，用于声明该 tool 对应输出类型的前端渲染 bundle。

#### Scenario: Tools list includes frontend_bundle when present
- **WHEN** 某输出类型存在可用的前端 bundle 声明
- **THEN** `/v1/workspace/tools` 返回的对应 tool SHALL 包含 `frontend_bundle`
- **AND** 当不存在前端 bundle 时该字段 SHALL 缺省或为 null（语义等价）

### Requirement: Host can disable frontend bundle advertisement
宿主 MUST 支持通过配置（例如 `app.features.workspace_frontend_bundles_enabled=false`）关闭 `frontend_bundle` 的对外暴露，以便在需要时强制回退到通用渲染器/Raw JSON（用于调试、回归或安全收敛）。

#### Scenario: Tools list omits frontend_bundle when disabled
- **WHEN** 运维将 `app.features.workspace_frontend_bundles_enabled` 设为 `false`
- **THEN** `/v1/workspace/tools` 返回的每个 tool 对象 SHALL 不包含可用 `frontend_bundle`（缺省或为 null）
- **AND** 客户端 SHALL 按 `render_descriptor > Raw JSON` 的回退路径渲染输出

### Requirement: FrontendBundleDescriptor is versioned and gated
前端 MUST 仅在 `frontend_bundle.api_version` 属于其支持集合时才尝试加载该 bundle；否则必须忽略并进入回退路径。

#### Scenario: Client ignores unsupported frontend_bundle.api_version
- **WHEN** 客户端收到 `frontend_bundle` 且其 `api_version` 不受支持
- **THEN** 客户端 SHALL 忽略该 bundle
- **AND** 客户端 SHALL 使用通用渲染器或 Raw JSON 回退渲染

### Requirement: Builtin bundles are loaded from a deterministic registry
当 `frontend_bundle.kind="builtin"` 时，前端 MUST 通过本地 registry（id → loader）确定性加载对应模块；不得依赖网络下载或不确定查找。

#### Scenario: Builtin bundle loads successfully
- **WHEN** `frontend_bundle.kind="builtin"` 且 registry 中存在匹配的 `id`
- **THEN** 客户端 SHALL 以 lazy import 方式加载该模块
- **AND** SHALL 从模块导出中解析出 `frontend_bundle.export` 指定的渲染器入口

#### Scenario: Missing builtin id falls back deterministically
- **WHEN** `frontend_bundle.kind="builtin"` 但 registry 中不存在该 `id`
- **THEN** 客户端 SHALL 不尝试加载未知模块
- **AND** SHALL 进入回退渲染路径（通用渲染器或 Raw JSON）

### Requirement: Bundle load failures never break rendering
无论 bundle 加载失败、导出不匹配或执行报错，客户端渲染链路 MUST 不崩溃，并进入可预测的回退路径。

#### Scenario: Import failure falls back to generic renderer
- **WHEN** 客户端尝试加载前端 bundle 但导入失败或导出入口无效
- **THEN** 客户端 SHALL 回退到 `render_descriptor` 驱动的通用渲染器（若存在）
- **AND** 若通用渲染器不可用，客户端 SHALL 回退到 Raw JSON 渲染
