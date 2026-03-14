# generation-variants-and-comparison Specification

## Purpose

为同一生成意图提供可选的多候选（variants）生成与比较/选定语义：共享意图与控制配置、提供结构化比较信息、显式选定主结果并保留可追溯选择历史。

## Non-goals

- 不把 variants 作为默认生成路径（保持默认单结果）
- 不在 v1 提供复杂 merge/blend 工作台

## Requirements

### Requirement: 系统必须支持在同一生成意图下生成多个 variant
系统 MUST 支持在同一生成类型与共享上下文下生成多个可比较候选结果。

#### Scenario: 用户请求多个候选结果
- **WHEN** 用户在适用场景下启用 variant 生成
- **THEN** 系统 SHALL 在同一生成意图下返回多个候选结果
- **AND** 这些候选 SHALL 共享同一类型与上下文边界

### Requirement: 系统必须提供结构化比较信息
系统 MUST 为多个 variant 提供结构化比较信息，以帮助用户完成选择。

#### Scenario: 用户比较多个候选结果
- **WHEN** 用户查看一个 variant 集合
- **THEN** 系统 SHALL 提供每个候选的结构化比较元数据
- **AND** SHALL 支持在候选之间切换和查看差异焦点

### Requirement: 用户必须能够选定工作结果
系统 MUST 允许用户从 variant 集合中显式选定一个工作结果，而不是让所有候选长期并列悬空。

#### Scenario: 用户确认其中一个 variant
- **WHEN** 用户选定一个候选结果
- **THEN** 系统 SHALL 记录该选定动作
- **AND** 被选定结果 SHALL 成为后续继续工作的主结果

### Requirement: variant 流程必须是可选且受限的观察项
系统 MUST 将 variant 作为可选流程提供，并保持默认单结果路径不变；同时系统 MUST 对 variant 数量与成本进行显式约束与提示。

#### Scenario: 默认生成路径不启用 variant
- **WHEN** 用户发起一次未显式启用 variant 的生成请求
- **THEN** 系统 SHALL 仅返回单个结果
- **AND** 系统 SHALL NOT 自动升级为多 variant 生成

#### Scenario: 用户显式请求多个候选
- **WHEN** 用户在生成请求中显式指定 variant 数量
- **THEN** 系统 SHALL 按请求返回多个候选结果
- **AND** 该数量 SHALL 被上限约束（v1 不超过 3）

#### Scenario: 系统建议用户尝试 variant
- **WHEN** 某次结果触发质量门警告（warn）
- **THEN** 系统 SHALL 能向客户端提供“建议启用 variant”的提示信息

### Requirement: 同一 VariantSet 内的候选必须共享生成意图与控制配置
系统 MUST 确保同一 VariantSet 内的所有候选共享同一 `generation_type_id`、同一输入上下文边界与同一控制配置（effective controls），避免候选之间因控制面漂移而不可比。

#### Scenario: 系统生成一个 VariantSet
- **WHEN** 系统为一次生成请求产生多个候选
- **THEN** 这些候选 SHALL 共享同一 `generation_type_id`
- **AND** 这些候选 SHALL 共享同一输入上下文边界
- **AND** 这些候选 SHALL 共享同一生效控制配置（preset/knobs 的最终值）

### Requirement: 多 variant 生成必须共享检索/上下文快照以控制成本
系统 MUST 支持在同一 VariantSet 内复用共享检索结果或上下文快照，使多候选流程主要增加生成成本而非重复检索成本。

#### Scenario: 系统为多个候选复用同一检索结果
- **WHEN** 系统在同一生成意图下生成多个候选
- **THEN** 系统 SHALL 复用同一共享检索结果或上下文快照
- **AND** 系统 SHALL 能在响应中标识该共享引用（例如 shared_context_ref）

### Requirement: 选定关系必须唯一且可追溯
系统 MUST 在一个 VariantSet 中保持唯一选定结果，并记录选定历史以支持回看与改选。

#### Scenario: 用户选定一个候选作为主结果
- **WHEN** 用户在一个 VariantSet 中选定某个候选
- **THEN** 系统 SHALL 将该候选标记为唯一选定结果
- **AND** 系统 SHALL 记录选定事件（包含时间与候选标识）

#### Scenario: 用户改选另一候选
- **WHEN** 用户将选定结果从候选 A 改为候选 B
- **THEN** 系统 SHALL 更新唯一选定结果为候选 B
- **AND** 系统 SHALL 追加记录一次选定事件
