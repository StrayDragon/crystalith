## Why

Crystalith 已经逐步拥有多种输入和输出能力，但用户真正的痛点往往不是“少一个按钮”，而是“不知道该怎么组合能力”。如果每次都要从空白状态开始选择来源、提问、选输出、改配置，系统会显得强大但难上手。

因此，这个 proposal 聚焦于 **workflow templates and recipes**：把常见的知识工作流封装成可复用模板，而不是让用户每次都自己编排。

## What Changes

- 新增工作流模板 / recipe 概念
- 提供常见模板，例如：资料导入 → briefing、导入 → slides、导入 → guide + quiz
- 支持模板预填 outputs、提示词、参数与步骤顺序
- 支持在 UI 中一键启动模板，而不是从空白工作区手工组合

## Before / After

### 实现前
- 用户需要自己理解功能并手动组合工作流
- 新手面对太多能力时容易不知道从哪里开始
- 结果质量很依赖用户是否知道“推荐路径”

### 实现后
- 用户可以从一组高价值 recipe 直接启动工作流
- 常见任务有明确入口和默认配置
- Crystalith 更像一个“能完成任务的工作台”，而不只是能力集合

## 优点

- 产品价值感最强，最容易提升上手体验
- 有助于把已有能力组织成可感知场景
- 能为后续官方最佳实践沉淀出稳定入口

## 风险与代价

- 如果底层能力变化快，模板维护成本会升高
- 模板过多会造成选择负担和产品复杂度
- 容易掩盖底层能力之间尚未统一的接口问题

## Capabilities

### New Capabilities
- `workflow-templates-and-recipes`: 提供工作流模板、默认参数与启动器能力

### Modified Capabilities
- `workspace-command-registry`: 需要支持模板入口与命令式启动
- `workspace-ui-core`: 需要新增模板启动与模板上下文展示
- `studio-output-types`: 模板需要与 outputs 配置能力联动

## Impact

- Backend
  - 需要新增模板描述模型与默认参数装配逻辑
- Frontend
  - 新增模板选择器、模板启动 UI 和模板上下文状态
- Product
  - Crystalith 从“功能库”变成“任务驱动的工作流产品”
