## Why

当数据连接、block editor、program、目标追踪和图表都补齐以后，团队自然会往前多走一步: 不是只看"现在怎样"，而是开始问"如果换一个假设会怎样"。这时候如果系统还只能做静态分析，很多真正有价值的讨论还是会回到 Excel、白板和会后口头结论。

## What Changes

- 引入 scenario workspace，允许围绕同一目标维护多组假设、变量、约束和候选策略。
- 支持比较不同 scenario 对输出、指标、briefing 和决策建议的影响，而不是只保留一个当前答案。
- 允许把数据视图、Notebook block、chart、program 里程碑和外部变量绑定到具体 scenario 上。
- 记录最终采纳了哪个 scenario、为什么采纳，以及放弃其他选项的理由，避免决策过程只留结果不留上下文。
- 让这条线与 `c2015`、`c2020`、`c4010`（图表与数据表达层）形成闭环：目标定义问题，program 推进执行，scenario 负责比较方案。

## Capabilities

### New Capabilities

- `scenario-planning-and-decision-simulations`: 定义情景分支、假设管理、对比视图和决策留痕能力。

### Modified Capabilities

- `outcome-goals-and-impact-tracking`: 需要支持目标与 scenario 的关联，而不是只跟单一路径绑定。
- `portfolio-agent-programs`: 需要支持 program 基于 scenario 分叉计划和回收决策。
- `charts-dashboards-and-data-storytelling`: 需要支持按 scenario 比较指标与叙事输出。
- `sandboxed-compute-cells-and-kernel-runtime`: 需要支持在隔离计算环境里执行 scenario 试算。
- `notebook-content-model-and-block-editor`: 需要支持 block 级 scenario 归属、比较和采纳标记。

## Impact

- Backend：需要新增 scenario、assumption set、comparison result 和 decision rationale 的对象模型。
- Frontend：需要补 scenario 切换、并排对比、假设编辑、采纳标记和回顾视图。
- Product：这条线不是为了把 Crystalith 变成另一个 BI 工具，而是让它真正承接"分析之后怎么选"这一步。
- Dependencies：建议接在 `outcome-goals-and-impact-tracking`、`portfolio-level-agent-programs`、`structured-data-connectors-and-sql-workflows`（含图表与看板）、`sandboxed-compute-cells-and-kernel-runtime`、`notebook-content-model-and-block-editor` 之后。

## Dependency Sketch

```mermaid
flowchart TD
  C25[c2015 目标与影响追踪]
  C30[c2020 program 编排]
  C49[c4010 图表与看板]
  C46[c2028 沙箱计算单元]
  C40[c2026 block 内容模型]
  C71[c2036 情景规划与决策模拟]

  C25 --> C71
  C30 --> C71
  C49 --> C71
  C46 --> C71
  C40 --> C71
```
