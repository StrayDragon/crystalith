## Why

我们已经有 `just llm-eval` 这类入口，但“能跑”不等于“能用来做决策”。没有一套稳定的 dataset 结构、scorecard 指标和对比方式，调参、改 prompt、换模型都会变成一次次的主观争论。

这份 change 只追求一件事：把评测做成一个最小可用的闭环，让团队能用数据讨论“这次改动到底好不好”。

## What Changes

- 定义 Eval 的最小数据模型：
  - dataset（样本集）+ scenario（场景）+ run（一次评测执行）+ scorecard（指标集合）
- 定义一套“最先落地”的 scorecard（先少、先稳）：
  - 检索：命中率、引用覆盖、重复引用率、证据多样性
  - 生成：结构完整性、事实一致性（可先用规则/弱监督）、失败率
- 把现有 `just llm-eval` 接到这套模型上：输出统一的结果包（可存储、可对比、可回放）。
- 提供最小的对比视图：
  - CLI：对比两次 eval 的 score 差异 + top regressions
  - UI（可选）：展示趋势与典型失败样本，优先服务开发者而不是做报表

## Capabilities

### New Capabilities

- `eval-center-minimum`: dataset/scorecard/run 的结构、输出格式与对比入口。

### Modified Capabilities

- `quality-and-regression`: eval 结果作为质量门禁的来源之一（先 warn，后 gate）。
- `quality-gates-for-generation`: 哪些输出必须过哪些 scorecard 阈值（逐步收紧）。
- `generation-variants-and-comparison`: 对比维度（模型/提示词/检索配置）如何记录与展示。
- `retrieval-and-cache`: 检索指标与 snapshot（引用 `c26`）在评测中的使用方式。

## Impact

- Backend/Infra：需要稳定的结果落盘与读取方式（本地优先，后续再考虑远端）。
- Product/Dev：改动讨论会更客观；也更容易建立“我们要守住什么底线”的共识。
- Dependencies：建议先落地 `c26` 的 snapshot，使评测样本更可解释；再配合 `c28` 的 repro pack 做可复现。

## Dependency Sketch

```mermaid
flowchart TD
  DS[Dataset] --> RUN[Eval Run]
  RUN --> RET[Retrieval snapshot (c26)]
  RUN --> GEN[Generation outputs]
  RET --> SC[Scorecards]
  GEN --> SC
  SC --> CMP[Compare / Trend]
```
