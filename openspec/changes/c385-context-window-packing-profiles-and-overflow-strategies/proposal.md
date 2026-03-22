## Why

上下文窗口不够时，系统总得丢东西。问题不是会不会丢，而是按什么规则丢、用户能不能理解这次为什么丢了这些。没有装配档位和溢出策略，结果波动会一直显得很玄。

## What Changes

- 定义 context window packing profile，区分研究优先、引用优先、结构优先等不同装配档位。
- 增加 overflow strategy，明确当窗口不够时的裁剪和压缩优先级。
- 支持把装配档位与输出类型、任务形态和模型能力挂起来。
- 让用户至少能看到当前走的是哪种装配策略，而不是完全黑箱。

## Capabilities

### New Capabilities
- `context-window-packing-profiles-and-overflow-strategies`: 定义上下文装配档位、溢出策略和可见性边界。

### Modified Capabilities
- `context-packing-and-token-budget-explainability`: 需要表达档位和溢出策略。
- `source-aware-generation-modes`: 不同模式需要声明装配偏好。
- `model-capability-profiles-and-output-compatibility`: 模型能力会约束可用档位。

## Impact

- Backend：会影响上下文装配器、裁剪逻辑和日志摘要。
- Frontend：会影响高级设置、解释面板和调试入口。
- Dependencies：这条线是 `c325` 的继续深化，补的是“为什么这次这么装”。
