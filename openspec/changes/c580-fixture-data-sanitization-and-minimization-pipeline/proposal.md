## Why

真实场景夹具越多，越容易带来另一个问题：夹具本身开始过重、过脏、带着不该留下的数据。没有一条专门的脱敏和最小化流水线，回归资产会越来越难维护。

## What Changes

- 定义 fixture data sanitization，把评测与回归夹具里的敏感和冗余信息清出去。
- 支持 minimization pipeline，只保留支撑场景所需的最小数据面。
- 区分可自动脱敏和需要人工复核的字段，避免误删关键信息。
- 让脱敏和最小化结果进入场景回归和真实评测采样的前置步骤。

## Capabilities

### New Capabilities
- `fixture-data-sanitization-and-minimization-pipeline`: 定义夹具数据脱敏、最小化和复核边界。

### Modified Capabilities
- `workspace-scenario-fixtures-and-regression-harness`: 夹具需要接入脱敏与最小化。
- `real-workspace-eval-dataset-capture-and-replay`: 真实片段采样需要消费脱敏结果。
- `quality-and-regression`: 需要把夹具质量纳入回归基线。

## Impact

- Backend：会影响夹具导出、脱敏规则和数据裁剪。
- Frontend：如有夹具管理界面，会影响预览与确认流程。
- Dependencies：这条线是 `c560` 的安全前置，也是长期维护的必要补件。
