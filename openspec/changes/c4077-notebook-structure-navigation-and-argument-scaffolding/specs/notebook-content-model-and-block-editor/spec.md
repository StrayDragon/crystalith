# notebook-content-model-and-block-editor 规范增量

## ADDED Requirements

### Requirement: Notebook Content MUST Be Represented as Stable Blocks
系统 MUST 将 notebook 内容表示为稳定的 block-based model，而不是把整页内容视为不可分辨的大文本。

#### Scenario: 用户编辑 notebook 内容
- **WHEN** 用户创建、编辑、折叠或审阅 notebook 内容
- **THEN** 系统 SHALL 以稳定 block 作为基本对象处理这些操作
- **AND** 每个 block SHALL 具备明确的类型与编辑边界

### Requirement: Blocks MUST Carry Structural and Provenance Metadata
系统 MUST 让 block 携带结构、来源和状态元数据，以支持后续导航、引用与审阅。

#### Scenario: 系统渲染或引用某个 block
- **WHEN** 某个 block 被展示、引用或复用
- **THEN** 该 block SHALL 提供稳定的结构标识与必要 provenance / state 信息
- **AND** 调用方 SHALL 不需要再为同一 block 另造一份平行语义
