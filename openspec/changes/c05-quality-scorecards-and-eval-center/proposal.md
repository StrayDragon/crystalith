## Why

团队迟早会问一个很实际的问题：这个结果到底算不算好，是这次好，还是一直都好。只有评测脚本还不够，产品里也需要一套看得见、能比较、能追踪的质量面板。

## What Changes

- 为每次生成结果引入统一 scorecard，覆盖覆盖率、引用密度、新鲜度、风险提示等核心指标。
- 增加工作区级 Eval Center，用来比较不同模型、不同 recipe、不同提示词的输出表现。
- 支持保存 baseline，方便回归检查和版本前后的质量对比。
- 让质量信号既能服务研发，也能服务内容审阅和产品判断。

## Capabilities

### New Capabilities

- `workspace-eval-center`: 定义结果评分、对比视图和基线保存能力。

### Modified Capabilities

- `quality-and-regression`: 需要从工程回归扩展到产品可见的质量比较。
- `quality-gates-for-generation`: 需要明确哪些信号进入 scorecard，哪些只用于后台诊断。
- `generation-variants-and-comparison`: 需要支持在产品里比较不同生成路径。
- `generation-observability-and-guardrails`: 需要补足质量、风险和运行时信号的汇聚方式。

## Impact

- Backend：评估信号汇总、结果对比、baseline 存储与检索。
- Frontend：Eval Center、scorecard 展示、过滤和对比交互。
- Dependencies：建议跟 `c04-evidence-gap-and-claim-checking` 联动讨论，这样可信度和评估不会变成两套话语体系。
