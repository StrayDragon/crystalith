# output-rendering-and-typing Specification (Delta)

## MODIFIED Requirements

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
