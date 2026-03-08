## Why

随着 Crystalith 的生成能力、插件数量和输出类型持续增加，系统会遇到一个越来越核心的问题：**我们如何知道结果质量是在变好还是变差？** 如果缺少统一质量门，会出现：

- schema 正确但内容无证据支持
- citation 存在但覆盖不足
- 某个 plugin 更新后输出质量回退却不易察觉
- 用户看见结果，但系统自己并不知道这次生成是否可信

因此，这个 proposal 聚焦于 **quality gates for generation**，把质量检查做成内建能力，而不只存在于离线测试或人工抽查中。

## What Changes

- 新增生成质量门：schema 合规、citation 覆盖、来源充分性、关键字段完整性等
- 支持在生成后对 output 打上质量状态或警告
- 为回归测试与线上观测提供统一质量指标
- 让插件和新输出类型在接入时能声明其最小质量要求

## Before / After

### 实现前
- 质量问题往往在用户使用时才暴露
- 测试与真实运行时的质量判断脱节
- 插件增多后，很难持续判断整体质量趋势

### 实现后
- 生成结果可以经过统一质量门检查
- 系统能更早发现质量退化和证据不足
- 插件生态扩展时，质量控制不再完全依赖人工经验

## 优点

- 长期价值高，能稳住复杂系统的可信度
- 对插件化和多输出扩展非常关键
- 有利于把“质量”从主观感觉变成可讨论指标

## 风险与代价

- 质量门设计不当会带来误报和额外摩擦
- 需要平衡检查成本与响应速度
- 不同输出类型的质量标准可能难以完全统一

## Capabilities

### New Capabilities
- `quality-gates-for-generation`: 提供运行时质量门、质量指标与回归判断能力

### Modified Capabilities
- `quality-and-regression`: 需要把线上/运行时质量门与现有回归体系对齐
- `generation-observability-and-guardrails`: 需要增加质量检查结果的观测与告警语义
- `workspace-api-contract`: 需要暴露结果质量状态或警告字段给前端

## Impact

- Backend
  - 新增质量检查器、质量结果模型与聚合指标
- Frontend
  - 新增质量提示、警告与解释视图
- Product
  - Crystalith 从“给出结果”演进为“给出带质量信号的结果”
