## Why

Crystalith 已经在往“基于来源做分析和生成”的方向发展，但当前更偏重“生成结果”，对“人如何审核证据、修正结论、确认版本”支持还不够系统：

- citation 存在，但审 evidence 的工作流还比较碎片化
- 输出被生成后，缺少“支持 / 存疑 / 待补证”的结构化审阅过程
- 用户想把 AI 结果真正用于知识生产时，需要更清晰的人审闭环

因此，这个 proposal 聚焦于 **evidence review workflow**，把“证据审阅”做成正式工作流，而不是零散交互。

## What Changes

- 新增 evidence review 会话或 review 状态模型
- 支持对 citation / source context 做逐条核查、标注和审阅结论
- 支持把 output 标记为草稿、待审、已确认或需修订
- 支持在审阅过程中沉淀 review notes，形成可追溯人审链路

## Before / After

### 实现前
- 用户可以看到 citations，但证据复核过程主要靠手工心智完成
- output 更像一次性生成结果，缺乏正式的人审状态
- 很难追踪“这份结论为什么被确认”

### 实现后
- evidence review 成为一等工作流
- 用户可以逐条核查关键证据并记录审阅意见
- output 可进入更可信的“已审阅”状态，而不只是“生成完成”

## 优点

- 显著提升结果可信度与可解释性
- 更符合研究、分析、咨询等高要求场景
- 能与未来的 publish / artifact lifecycle 自然衔接

## 风险与代价

- 会增加交互层级与使用摩擦，不适合所有轻量场景
- 需要非常清晰地设计 review UI，避免变成复杂表单系统
- 可能引入新的状态管理复杂度

## Capabilities

### New Capabilities
- `evidence-review-workflow`: 提供 citation 审阅、review note 与输出确认状态能力

### Modified Capabilities
- `output-rendering-and-typing`: 需要支持 output 的 review 状态和辅助视图
- `workspace-ui-panels`: 需要为 evidence review 提供稳定入口和审阅面板
- `generation-observability-and-guardrails`: 需要把 evidence review 结果与生成质量反馈关联

## Impact

- Backend
  - 新增 review 状态、review note 与证据核查记录模型
- Frontend
  - 新增 evidence review 面板与状态展示
- Product
  - Crystalith 从“能生成内容”进一步迈向“能支持内容审阅与确认”
