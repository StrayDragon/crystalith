# notebook-import-export-interoperability 规范增量

## ADDED Requirements

### Requirement: Notebook Interchange MUST Use Explicit Fidelity and Downgrade Semantics
系统 MUST 为 notebook import/export 定义明确 fidelity 与 downgrade 语义，而不是隐式丢失结构。

#### Scenario: 用户导出 notebook 到外部格式
- **WHEN** notebook 被导出到 Markdown、Jupyter、PDF、Slides 或等价格式
- **THEN** 系统 SHALL 说明哪些内容被保真导出、哪些内容被降级映射
- **AND** SHALL 提供对应 mapping 或 downgrade report

### Requirement: Import and Export MUST Preserve Version and Provenance Links Where Possible
系统 MUST 在可行范围内为 notebook interchange 保留 version 与 provenance 关联，而不是导出后彻底断链。

#### Scenario: 用户导入或重新导入一个外部 notebook 资产
- **WHEN** 系统执行 notebook import 或 export
- **THEN** 系统 SHALL 尽可能保留版本摘要与来源关系
- **AND** 调用方 SHALL 能理解该互通过程的保真度边界
