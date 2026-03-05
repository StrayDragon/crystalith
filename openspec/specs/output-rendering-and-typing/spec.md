# output-rendering-and-typing Specification

## Purpose

定义输出在前端的类型建模与渲染契约：typed payload 判别联合、运行时 guard、通用渲染器与回退路径。该规范确保新输出类型不会破坏渲染链路，并为未知输出提供安全降级。

## Non-goals

- 不定义后端生成算法
- 不定义具体业务工具内容

## Requirements

### Requirement: Output payload is modeled as discriminated union
前端 MUST 以 `output.type` 作为判别字段建模 payload，保证类型 narrowing 可用；当输出类型来自插件且客户端未知时，类型系统 MUST 提供一个 “unknown/other” 分支以避免编译期与运行期崩溃。

#### Scenario: Type narrowing supports unknown plugin output types
- **WHEN** 前端收到一个带有未知 `output.type` 的输出 payload（未在客户端枚举/联合类型中声明）
- **THEN** 系统 SHALL 将其归入 unknown 分支并进入安全降级渲染路径
- **AND** 不得因类型缺失导致渲染链路崩溃

### Requirement: Runtime decode provides safe fallback
运行时 decoder/guard MUST 在 shape 不匹配时回退到 raw/unknown 渲染，不得崩溃。

#### Scenario: Unknown output shape does not crash UI
- **WHEN** 输出 payload 的 shape 与预期类型不匹配
- **THEN** 系统 SHALL 回退到 raw/unknown 渲染并保持 UI 不崩溃

### Requirement: GenericOutputRenderer supports canonical layouts
通用渲染器 MUST 支持规范布局类型与字段描述符递归渲染。

#### Scenario: Render canonical layout
- **WHEN** 输出使用规范布局与字段描述符
- **THEN** GenericOutputRenderer SHALL 能递归渲染该布局

### Requirement: RenderDescriptor contract is stable
workspace tools 返回的 `render_descriptor`/`config_schema` 字段语义 MUST 稳定。

#### Scenario: Tool schemas remain compatible
- **WHEN** 前端基于 `render_descriptor`/`config_schema` 渲染工具输出
- **THEN** 字段语义 SHALL 保持稳定以避免客户端漂移

### Requirement: Rendering priority is deterministic
渲染优先级 MUST 为 `frontend_bundle renderer > GenericOutputRenderer > Raw JSON`：

- `frontend_bundle renderer`：由后端在 `/v1/workspace/tools` 返回的 `frontend_bundle` 声明驱动加载与渲染
- `GenericOutputRenderer`：由后端返回的 `render_descriptor` 驱动的声明式渲染
- `Raw JSON`：最终安全回退

#### Scenario: Renderer selection follows priority
- **WHEN** 某输出类型同时存在 `frontend_bundle` 与 `render_descriptor`
- **THEN** 系统 SHALL 优先选择 `frontend_bundle` 对应的专用渲染器
- **AND** 仅当专用渲染器不可用/不兼容/加载失败时，才回退到通用渲染器或 Raw JSON

#### Scenario: Unsupported or broken bundle falls back safely
- **WHEN** `frontend_bundle` 的 `api_version` 不受支持，或 bundle 加载/导出解析失败
- **THEN** 系统 SHALL 回退到 `render_descriptor` 驱动的通用渲染器（若存在）
- **AND** 若通用渲染器不可用，系统 SHALL 回退到 Raw JSON 渲染
