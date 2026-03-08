## Why

Crystalith 当前的核心工作流基本围绕单个 notebook 展开：来源导入、检索、QA、结构化输出都以 notebook 为天然边界。这让单主题工作较清晰，但也带来几个问题：

- 用户经常把相关资料拆在多个 notebook 中，跨本分析需要手动重复导入或切换上下文
- 生成 briefing / guide / timeline 时，难以自然地聚合多个 notebook 的资料
- notebook 更像“存储分区”，但用户想要的是“面向问题的工作集合”

因此，这个 proposal 的目标是引入 **collection** 这一更高一层的工作单元，让多个 notebook 可以被组合成一个可检索、可问答、可产出的集合。

## What Changes

- 新增 `collection` 概念，作为 notebook 之上的聚合层
- 支持把多个 notebook 绑定到同一个 collection
- 提供 collection 级别的检索、QA、输出生成与来源范围控制
- 在 UI 中提供 collection 视图，而不是只依赖单 notebook 侧边栏与切换器
- 明确 notebook 与 collection 的边界：notebook 负责资料归档，collection 负责面向任务的聚合工作

## Before / After

### 实现前
- 每次检索、QA、输出基本只作用于一个 notebook
- 跨 notebook 工作依赖用户手工切换与心智拼接
- 相近主题资料容易重复导入到不同 notebook

### 实现后
- 用户可在一个 collection 中组合多个 notebook 作为统一工作上下文
- 跨 notebook 的 QA / 输出生成成为一等能力
- notebook 更像资料仓，collection 更像项目工作台

## 优点

- 更贴近真实知识工作方式，适合专题研究与复杂任务组织
- 降低资料重复导入和手工切换成本
- 能把现有 notebook 能力提升为更强的“跨仓工作流”

## 风险与代价

- 会增加检索与排序策略复杂度，尤其是跨 notebook citation 呈现
- UI 信息架构会更复杂，需要重新梳理 notebook / collection 的导航关系
- 若未来引入权限系统，collection 与 notebook 的授权关系需要额外定义

## Capabilities

### New Capabilities
- `multi-notebook-collections`: 提供 notebook 聚合、collection 级别检索与产出能力

### Modified Capabilities
- `workspace-ui-panels`: 需要新增 collection 导航与上下文切换
- `retrieval-and-cache`: 需要支持跨 notebook 的检索上下文聚合
- `workspace-api-contract`: 需要暴露 collection 模型、绑定关系与 collection-scoped 端点

## Impact

- Backend
  - 新增 collection 数据模型与 notebook 绑定关系
  - 调整检索、QA、outputs 以支持 collection 作用域
- Frontend
  - 新增 collection 级导航与视图状态
  - 需要明确 collection 和 notebook 的切换体验
- Product
  - Crystalith 从“单 notebook 工具”升级为“面向问题的多资料工作台”
