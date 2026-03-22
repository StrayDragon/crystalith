## Why

现在已经有 evidence review 的方向，但真正让人头疼的往往不是“审不审”，而是“哪里最值得先审”。如果在正式审阅前就能先指出证据薄弱区，整条可信闭环会轻很多。

## What Changes

- 引入 claim-level 的支撑度分析，标出证据充足、证据薄弱和无证据支撑的段落。
- 生成结果时同步产出 evidence gap 摘要，方便用户决定是补资料、改问题，还是继续审阅。
- 为弱支撑内容提供可执行动作，比如“补充来源”“限制范围重跑”“进入审阅模式”。
- 让 evidence review 能接收 claim check 的预分析结果，而不是从零开始看全文。

## Capabilities

### New Capabilities

- `claim-support-analysis`: 定义声明级支撑度检查和 evidence gap 摘要。

### Modified Capabilities

- `evidence-review-workflow`: 需要吸收 claim check 结果作为审阅入口的一部分。
- `generation-core`: 需要定义生成完成后 claim support 分析的稳定挂接点。
- `quality-gates-for-generation`: 需要把 evidence gap 纳入质量信号，而不是只看流程成功。
- `output-rendering-and-typing`: 结果渲染需要支持段落级或区块级支撑提示。

## Impact

- Backend：结果后处理、claim/evidence 映射、质量信号计算。
- Frontend：输出视图、审阅入口、证据缺口提示和修复动作。
- Dependencies：建议放在来源健康之后推进，否则“证据不足”很容易和“来源本身没处理好”混在一起。
