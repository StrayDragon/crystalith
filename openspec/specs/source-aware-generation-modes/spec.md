# source-aware-generation-modes Specification

## Purpose

为不同生成类型定义清晰、可解释的来源使用模式（source_mode），让检索、citation 预期、来源展示与结果元数据形成一致语义，并避免把内部策略术语直接暴露为产品标签。

## Non-goals

- 不反向重写生成类型或来源对象的上游模型（消费 typed-generation-framework 与 sources）
- v1 不支持混合模式或自动切换（每次生成单一模式）

## Requirements

### Requirement: 生成类型必须能够声明来源使用模式
系统 MUST 允许生成类型声明其来源使用模式，以表达不同的来源依赖预期。

#### Scenario: 某个生成类型需要严格来源约束
- **WHEN** 系统注册一种需要强证据支持的生成类型
- **THEN** 该类型 SHALL 能声明对应的来源使用模式
- **AND** 该模式 SHALL 成为后续生成装配的一部分

### Requirement: 来源模式必须影响 citation 与来源展示预期
系统 MUST 让来源模式影响 citation 行为和来源展示边界，而不是只作为内部策略标签存在。

#### Scenario: 用户查看不同来源模式的结果
- **WHEN** 两个结果采用不同来源使用模式
- **THEN** 系统 SHALL 能在 citation 预期或来源展示上体现差异
- **AND** 用户 SHALL 能理解当前结果对来源的依赖方式

### Requirement: 来源模式不得反向重写上游对象模型
系统 MUST 将来源模式建立在稳定的生成类型和来源对象语义之上，而不是借此重写上游定义。

#### Scenario: 为某个类型新增来源模式
- **WHEN** 系统新增或调整某个来源模式
- **THEN** 该变更 SHALL 消费既有类型与来源对象模型
- **AND** SHALL NOT 反向定义新的类型或接入基础语义

### Requirement: 生成请求与结果必须显式表达生效的来源模式
系统 MUST 在生成请求与结果元数据中显式表达本次生效的来源模式，以支持可解释行为与一致的 UI 呈现。

#### Scenario: 客户端覆盖默认来源模式
- **WHEN** 客户端在生成请求中显式指定来源模式
- **THEN** 系统 SHALL 校验该模式是否被该生成类型允许
- **AND** 系统 SHALL 使用该模式装配本次生成

#### Scenario: 系统返回生成结果
- **WHEN** 系统返回某次生成结果
- **THEN** 结果元数据 SHALL 回传本次生效的来源模式
- **AND** SHOULD 回传来源使用摘要（例如 sources_considered / sources_cited / citations_count）

### Requirement: 来源模式必须影响检索与上下文构造行为
系统 MUST 让来源模式影响检索、上下文构造与证据约束行为，而不是只改变展示文案。

#### Scenario: strict_evidence 模式下的生成
- **WHEN** 某次生成以 strict_evidence 模式执行
- **THEN** 系统 SHALL 以可引用的来源片段构造上下文并强制 citation 预期
- **AND** 在证据不足时 SHALL 显式提示不足，而不是伪造引用链

#### Scenario: brainstorming 模式下的生成
- **WHEN** 某次生成以 brainstorming 模式执行
- **THEN** 系统 SHALL 允许在不强制 citation 的前提下生成
- **AND** 若展示来源，SHALL 将其标识为背景参考而非证据

### Requirement: 用户可见的来源模式标签不得直接暴露内部策略术语
系统 MUST 使用可理解的产品概念向用户表达来源模式，而不是把内部策略术语直接当作产品标签。

#### Scenario: UI 展示来源模式
- **WHEN** UI 展示某次结果的来源依赖方式
- **THEN** 系统/前端 SHALL 使用用户可理解的来源模式标签与解释文案
- **AND** SHALL NOT 直接把内部枚举名或检索参数作为产品概念展示
