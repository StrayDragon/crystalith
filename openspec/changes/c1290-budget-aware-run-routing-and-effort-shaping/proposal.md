## Why

预算感已经能被看到，但还没有真正进入“如何路由这次执行”的核心逻辑。个人产品不该默认每次都走最贵、最重的路线。

## What Changes

- 定义 budget-aware routing，让 run 根据当前预算上限和目标类型自动塑形执行强度。
- 增加 effort shaping，控制本次执行是轻探、标准、重证还是高压精修。
- 支持努力强度影响上下文装配、模型选择和输出落点。
- 保持用户可一键覆盖默认路由，不把预算逻辑变成硬限制。

## Capabilities

### New Capabilities
- `budget-aware-run-routing-and-effort-shaping`: 定义预算感知路由和执行强度塑形。

### Modified Capabilities
- `tool-budget-ledger-and-step-cost-attribution`: 历史账本需要成为路由依据。
- `toolchain-capability-negotiation-and-fallback-order`: 协商层需要吸收预算档位。
- `answer-shape-presets-and-output-landing-zones`: 结果落点需要受 effort shaping 影响。

## Impact

- Backend：会影响执行路由、预算档位和强度策略。
- Frontend：会影响 run 配置、预算提示和建议默认值。
- Dependencies：这条线承接 `c685`、`c885`、`c1090`，会让“怎么跑”更贴近个人成本判断。

```mermaid
flowchart LR
  C685[c685 工具预算账本]
  C885[c885 工具链协商]
  C1090[c1090 回答形状预设]
  C1290[c1290 预算感知路由]

  C685 --> C1290
  C885 --> C1290
  C1290 --> C1090
```
