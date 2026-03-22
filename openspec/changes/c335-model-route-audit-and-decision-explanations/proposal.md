## Why

模型路由一旦开始智能化，用户和开发者迟早会问：这次为什么选了这个模型，而不是另一个。如果只能看到结果，看不到路由决策，信任会慢慢掉。

## What Changes

- 定义 model route audit，记录模型路由的关键判断因素。
- 支持 decision explanation，说明这次选择受到了哪些能力、预算和兼容性因素影响。
- 区分建议性解释和严格因果解释，避免把启发式判断说得太像定理。
- 让路由审计结果回流到生成详情、预警提示和回归对比。

## Capabilities

### New Capabilities
- `model-route-audit-and-decision-explanations`: 定义模型路由审计、决策解释和回链语义。

### Modified Capabilities
- `model-capability-profiles-and-output-compatibility`: 需要输出可被解释的决策输入。
- `generation-fallback-strategies-and-safe-degradation`: 回退决策需要能进入路由审计。
- `quality-and-regression`: 路由解释需要进入评测与诊断。

## Impact

- Backend：会影响路由器日志、解释摘要和诊断接口。
- Frontend：会影响生成详情、模型提示和诊断视图。
- Dependencies：这条线补强 `c350` 和 `c375`，把模型层的自动化拉到可解释。
