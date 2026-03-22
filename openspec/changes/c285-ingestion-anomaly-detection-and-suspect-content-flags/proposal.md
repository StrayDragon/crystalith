## Why

有些导入不是彻底失败，而是成功得很可疑，比如正文突然很短、标题异常、提取结果像导航页。没有异常检测，用户很容易把坏内容当正常来源继续往下用。

## What Changes

- 定义 ingestion anomaly detection，识别异常短文、重复片段、异常标题和明显脏内容。
- 增加 suspect content flag，把可疑来源显式标出来，而不是沉在后台分数里。
- 区分高置信异常和轻度疑点，避免误报过多。
- 让异常标记回流到来源详情、批处理和重试恢复。

## Capabilities

### New Capabilities
- `ingestion-anomaly-detection-and-suspect-content-flags`: 定义接入异常检测、可疑内容标记和分级提示。

### Modified Capabilities
- `source-trust-signals-and-quality-hints`: 需要消费异常标记。
- `source-ingestion-retry-recovery-and-partial-success`: 异常来源需要有更明确的恢复入口。
- `workspace-api-contract`: 需要暴露异常标记与类型摘要。

## Impact

- Backend：会影响异常规则、内容诊断和来源标记。
- Frontend：会影响来源卡片、详情页和批量修复入口。
- Dependencies：这条线是 `c260` 的更具体一层，处理“看起来怪”的来源。
