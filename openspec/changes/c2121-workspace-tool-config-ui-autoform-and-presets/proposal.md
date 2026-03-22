## Why

SystemConfigDialog 已经证明：用 overlay + 列表 + 编辑器的组合，管理“可变但重要”的配置是可行的。工具配置也是同一类问题，只是对象从 prompt preset 变成了 workspace tools。

如果没有一个统一入口，配置会散在：

- 每个输出类型一个小弹窗
- 某些面板有、某些面板没有
- 不同工具的选项命名不一致

久了以后，维护成本会比功能本身还高。

## What Changes

- 增加 “Tools Config” overlay（位置：workspace overlays 或 diagnostics 内）：
  - 左侧工具列表（来自 `/v1/workspace/tools`）
  - 右侧配置编辑（读写 `/v1/workspace/tool-config`）
- “AutoForm” 不做成通用 JSON Schema 生成器，而是直接基于 `PluginConfigSchema`：
  - 对 `*_options` 自动渲染 Select（quantity/tone/language…）
  - `defaults` 用作初始值与 reset 依据
  - `supports_topic/topic_placeholder` 决定是否显示 topic 输入
  - `theme_preset_options` 渲染为模板预览 + 选择
- Presets（同一 tool 内多套配置）：
  - 一个 tool 支持多个 preset，用户可以一键切换
  - 只保存差异（diff-friendly），支持“回滚到上一个版本”
- 错误与提示统一：
  - 保存失败使用 `c2020` 的分层错误 UI
  - `retry_after`（如果有）在按钮上做倒计时，避免狂点

## Capabilities

### New Capabilities

- `workspace-tool-config-ui-autoform`: 基于 `PluginConfigSchema` 的配置编辑 UI、presets 与回滚入口。

### Modified Capabilities

- `workspace-ui-core`: 需要承载全局配置入口与 overlay 路由。
- `frontend-error-ux-and-recovery-actions-unification`: 配置保存/校验失败要有一致呈现。（`c2020`）
- `workspace-tool-config-persistence-contract`: 依赖 `c2120`。

## Impact

- Frontend：减少重复表单代码，配置入口更好找、更一致。
- Backend：几乎不需要为 UI 做定制接口，只要 schema+value 稳定就行。
- Risk：如果 UI 变成“全能设置中心”，会打断工作流；入口需要克制，先覆盖高频 tools。

## Dependency Sketch

```mermaid
flowchart TD
  Tools[/v1/workspace/tools/] --> UI[Tools Config UI]
  Schema[/v1/workspace/tools/{id}/config/] --> UI
  Values[/v1/workspace/tool-config/] --> UI
  UI --> Save[PUT tool-config/{id}]
  UI --> Reset[POST tool-config/{id}:reset]
```
