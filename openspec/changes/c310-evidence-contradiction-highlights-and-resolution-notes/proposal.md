## Why

不是所有矛盾都要被系统自动解决。很多时候，用户更需要先看见矛盾点，再留下自己的判断。现在如果矛盾只藏在分析结果里，后续很难追踪“为什么最后采纳了这个说法”。

## What Changes

- 定义 evidence contradiction highlight，把来源之间和结论之间的明显冲突标出来。
- 支持 resolution note，让用户记录对某个矛盾点的判断与暂定处理。
- 区分真正互相冲突和只是口径不同，避免误报太多。
- 让矛盾与处理记录能回到 evidence map、briefing 和后续复盘。

## Capabilities

### New Capabilities
- `evidence-contradiction-highlights-and-resolution-notes`: 定义证据矛盾高亮、处置记录和回链语义。

### Modified Capabilities
- `evidence-review-workflow`: 审阅流程需要支持矛盾点与处置说明。
- `source-coverage-and-evidence-map`: 需要展示矛盾聚集区。
- `publishable-artifacts`: 需要支持带出处置说明的结论摘要。

## Impact

- Backend：会影响矛盾检测、处置记录和回链结构。
- Frontend：会影响 evidence map、审阅界面和处理说明展示。
- Dependencies：这条线补的是“看见矛盾以后怎么办”。
