## Why

生成产物和前端 bundle 一旦开始积累，很容易出现一种拖慢系统但不显眼的问题：旧资产还在，旧 bundle 也还挂着，大家都没马上察觉。没有专门的清理和陈旧检测，这类问题只会越来越多。

## What Changes

- 定义 generated asset cleanup，针对过期媒体、旧输出附属资产和残留中间件做清理建议。
- 支持 stale bundle detection，发现已不该继续被引用的旧 bundle 或旧插件产物。
- 区分可安全删除和需要人工确认的资产，避免误删仍在引用的内容。
- 让清理结果回流到存储视图、插件诊断和回归检查。

## Capabilities

### New Capabilities
- `generated-asset-cleanup-and-stale-bundle-detection`: 定义生成资产清理、陈旧 bundle 检测和确认边界。

### Modified Capabilities
- `plugin-registry-health-and-compatibility-diagnostics`: 需要消费陈旧 bundle 结果。
- `storage-compaction-archive-vacuum-and-retention-preview`: 清理建议需要进入存储维护链路。
- `output-renderer-unification-and-plugin-bundle-splitting`: 分包结果需要支持陈旧检测。

## Impact

- Backend：会影响资产扫描、引用检查和清理建议。
- Frontend/Tooling：会影响 bundle 诊断和维护提示。
- Dependencies：这条线是 `c550` 的补件，也会帮 `c545` 把“兼容问题”里的一部分原因提早揪出来。
