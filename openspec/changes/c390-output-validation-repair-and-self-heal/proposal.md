## Why

有些输出不是完全坏，而是少一个字段、少一段结构、某个块不合法。遇到这种情况，如果只能失败或重跑，成本太高。很多结果其实值得先修一下。

## What Changes

- 定义 output validation repair，对结构不完整但可修的输出做轻量修补。
- 支持 self-heal，但只在明确安全的范围内修补，不偷偷改掉核心内容。
- 区分自动可修、需用户确认和必须重跑三类情况。
- 让修补过程可见、可比较、可回退，而不是悄悄替换结果。

## Capabilities

### New Capabilities
- `output-validation-repair-and-self-heal`: 定义输出校验修补、自愈边界和回退语义。

### Modified Capabilities
- `output-draft-lifecycle-and-regeneration-safety`: 修补后的结果需要有清楚的状态。
- `output-diff-compare-and-version-review`: 修补前后需要可比较。
- `generation-core`: 需要支持校验后修补与再验证流程。

## Impact

- Backend：会影响输出校验、修补器和结果状态流转。
- Frontend：会影响输出错误提示、修补入口和差异展示。
- Dependencies：这条线介于 `c370` 和 `c440` 之间，补的是“不至于整次作废”的那段。
