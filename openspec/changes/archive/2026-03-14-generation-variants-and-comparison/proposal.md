## Why

AI 生成很难保证第一次就正中用户真实需要。很多时候，用户并不是要“再试一次”，而是希望看到几个合理方向，再决定哪个更适合当前工作。如果系统只能给一个单结果入口，就会出现：

- 用户在“继续用”与“重新来过”之间反复摇摆
- 系统不能显式支持风格比较、结构比较或证据充分性比较
- 好的生成结果常常不是一次命中，而是通过对比后选出来的

因此，这个 proposal 聚焦于 **generation variants and comparison**：让同一生成类型可以产生多个候选结果，并支持可理解的比较。

## What Changes

- 支持同一输入生成多个 variant，而不是只返回单一结果
- 提供 variant 之间的比较视图，例如结构差异、重点差异、语气差异、证据差异
- 支持从多个候选中选定一个继续编辑，或基于比较结果再做进一步 refinement
- 让“多版本对比”成为生成工作流的一部分，而不是用户手工复制粘贴比较

## Before / After

### 实现前
- 单次生成命中不准时，用户只能不断重试
- 多个结果之间缺少稳定对比方式
- 系统无法帮助用户理解“这两个结果到底差在哪”

### 实现后
- 用户可以更自然地比较不同生成方向
- 选择过程更可见，而不是完全靠记忆或感觉
- Crystalith 可以支持“选更好的结果”，而不只是“再生成一个结果”

## 优点

- 很适合处理 AI 命中不稳定的问题
- 能提升用户对系统的掌控感，而不是被单次结果绑住
- 与结果 refinement、质量门和类型优化都能自然联动

## 风险与代价

- 多版本会增加视觉复杂度和计算成本
- 如果比较信号太弱，用户仍可能觉得“看起来都差不多”
- 需要控制何时默认单结果，何时值得进入多 variant 流程

## Capabilities

### New Capabilities
- `generation-variants-and-comparison`: 提供多候选生成、对比与结果选择能力

### Modified Capabilities
- `generation-core`: 需要支持单请求生成多个可比较候选
- `workspace-ui-panels`: 需要承载 variant 列表、对比与选择交互
- `workspace-api-contract`: 需要暴露 variant 集合、对比元数据与选定结果接口
- `generation-observability-and-guardrails`: 需要记录 variant 生成与选择行为

## Impact

- Backend
  - 新增 variant 生成编排、候选对比元数据与结果选定逻辑
- Frontend
  - 新增 variant 对比、切换与选定体验
- Product
  - Crystalith 从“给一个结果”升级为“帮助用户选结果”
