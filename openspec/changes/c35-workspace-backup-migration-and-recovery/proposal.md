## Why

一旦 notebook、artifact、review 记录和运行历史开始变成团队资产，大家迟早会问两个很朴素的问题：出了问题能不能救回来，换环境或换版本能不能迁过去。没有备份、迁移和恢复能力，前面的协作和治理做得越完整，切换成本反而越高。

## What Changes

- 提供 workspace / notebook / artifact 级别的快照、导出、导入和恢复能力，而不是默认把数据库当成唯一真相。
- 引入迁移包和 dry-run 预检，让跨环境迁移、跨版本升级和灾难恢复有正式入口。
- 为 sources、sessions、runs、knowledge packs 和 review 历史定义最小可恢复边界，避免恢复后只剩半套数据。
- 允许管理员查看恢复影响范围、冲突对象和回滚路径，而不是直接执行黑盒操作。

## Capabilities

### New Capabilities

- `workspace-backup-migration-and-recovery`: 定义快照、迁移包、恢复流程、冲突处理和回滚边界。

### Modified Capabilities

- `data-and-storage`: 需要支持快照元数据、恢复状态和迁移版本语义。
- `workspace-api-contract`: 需要提供导出、导入、恢复和预检接口。
- `delivery-and-deployment`: 需要明确跨环境迁移和灾难恢复的最小要求。
- `publishable-artifacts`: 需要定义发布产物在导出、恢复和跨环境迁移时的保真边界。

## Impact

- Backend：快照打包、恢复编排、版本迁移、冲突检测和回滚控制。
- Frontend/Admin：导出导入向导、恢复预检、冲突提示和任务进度页。
- Operations：这会明显降低试点扩张、环境迁移和故障恢复时的心理门槛。
- Dependencies：建议接在 `c18-compliance-retention-and-data-governance`、`c23-artifact-versioning-and-release-channels`、`c34-private-deployment-and-regional-data-plane` 之后讨论。
