# studio-slides-workflow Specification (Delta)

## MODIFIED Requirements

### Requirement: Draft API contract is stable
draft CRUD、outline 保存、markdown 保存端点 MUST 保持稳定；当 slides workflow capability 不可用时，这些端点 MUST 返回稳定且可执行的 unavailable 诊断，而不是假设 slides 默认可用。

#### Scenario: Draft endpoints fail fast when slides plugin is unavailable
- **WHEN** 客户端在未安装/未启用/未选定 active slides workflow plugin 的情况下创建或生成 slides draft
- **THEN** 系统 SHALL 返回稳定 error_code / message / hint / details
- **AND** SHALL 不创建或推进一个无效的 running draft

### Requirement: Preview always uses latest saved markdown
预览前端流程 MUST 先保存 markdown，再刷新当前 active slides workflow plugin 声明的预览目标；宿主与客户端 MUST NOT 硬编码 Slidev 作为唯一预览实现。

#### Scenario: Preview uses plugin-declared renderer
- **WHEN** 用户触发预览刷新且当前 active slides workflow plugin 已声明 preview contract
- **THEN** 系统 SHALL 先保存 markdown
- **AND** 客户端 SHALL 刷新该 plugin 声明的预览目标以确保一致性

## ADDED Requirements

### Requirement: Slides UI availability follows tools contract
Studio slides 相关 UI（工具卡片、dialog、入口动作）MUST 以 `/v1/workspace/tools` 返回的 `SLIDES` tool 作为可用性唯一来源，不得依赖硬编码假设 slides 默认存在。

#### Scenario: Slides dialog is gated by tools availability
- **WHEN** `/v1/workspace/tools` 未返回 `SLIDES`
- **THEN** 客户端 SHALL 不把 slides 视为可直接打开的可用能力
- **AND** 若 `diagnostics` 提供恢复提示，客户端 SHALL 展示对应指引

