## Why

模型一多，真正让人困扰的往往不是“能不能选”，而是“这个模型对这个输出到底合不合适”。如果系统只是给一个模型列表，用户最后还是得自己踩坑。

## What Changes

- 定义 model capability profile，把结构化输出、长上下文、速度、成本等级和稳定性收成更直观的画像。
- 增加 output compatibility 语义，说明某类输出或工作流对模型的推荐程度和已知限制。
- 让模型选择不再只是配置项，而是和 output type、research run、refine 直接挂钩。
- 支持在不强制替换用户选择的前提下，给出更像话的模型建议和警告。

## Capabilities

### New Capabilities
- `model-capability-profiles-and-output-compatibility`: 定义模型能力画像、输出兼容性和建议边界。

### Modified Capabilities
- `config-and-models`: 需要表达更细的模型能力与限制。
- `generation-core`: 需要消费模型兼容性信息装配生成请求。
- `studio-output-types`: 输出类型需要声明对模型能力的偏好。
- `workspace-ui-core`: 需要在模型选择处给出兼容性提示。

## Impact

- Backend：会影响模型配置、能力声明和请求装配逻辑。
- Frontend：会影响模型选择器、提示信息和输出入口的模型推荐。
- Dependencies：这条线和 `c345` 配套，一个处理运行时约束，一个处理模型能力边界。

```mermaid
flowchart LR
  C345[c345 并发预算]
  C350[c350 模型能力画像]
  C355[c355 Prompt 预设谱系]

  C345 --> C350
  C350 --> C355
```
