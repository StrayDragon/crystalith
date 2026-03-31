# output-renderer-unification-and-template-versioning 规范增量

## ADDED Requirements

### Requirement: Output Rendering MUST Use a Unified Registry Contract
系统 MUST 为每个输出类型提供统一的 registry contract（schema、renderer、导出能力、fallback 语义），避免同一输出在不同页面/导出路径出现不一致渲染。

#### Scenario: 同一输出在不同入口被查看
- **WHEN** 用户从不同页面或导出入口查看同一 output type 的结果
- **THEN** 宿主 SHALL 通过统一 registry 选择渲染器与导出路径
- **AND** 缺失渲染器或加载失败时 SHALL 进入稳定 fallback（通用渲染或 Raw JSON）

### Requirement: Output Type Extensibility Boundaries MUST Be Explicit
系统 MUST 明确 output type 的可扩展边界：插件覆盖与新增类型的差异必须可预测且可诊断。

#### Scenario: 插件声明一个未被宿主支持的 output type
- **WHEN** 插件试图声明一个宿主未收录/不可持久化的 output type
- **THEN** 宿主 SHALL 阻止其成为可用能力
- **AND** SHALL 输出结构化诊断（例如 required migration/registry 扩展的提示）

### Requirement: Renderer Errors MUST Be Structured and User-Explainable
渲染器错误 MUST 能携带结构化错误信息，以支持 UI 呈现恢复动作与排障路径。

#### Scenario: 渲染器加载失败或输出载荷不兼容
- **WHEN** 渲染器加载失败、bundle 缺失或输出载荷与 schema 不兼容
- **THEN** 系统 SHALL 记录结构化错误信息并可被 UI 消费
- **AND** 用户仍可通过 fallback 路径查看输出（不应造成页面崩溃）
