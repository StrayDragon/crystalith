## Why

存储重不重，用户通常不会关心总量，他们更关心“到底是哪些东西在拖”。没有体积分解和重对象发现，存储治理就只能停在模糊层面。

## What Changes

- 定义 storage footprint breakdown，按对象类型、时间和工作区范围拆解存储占用。
- 支持 heavy object finder，定位异常大的来源、输出、媒体和历史对象。
- 区分当前热对象和历史沉积对象，避免一把刀全清。
- 让体积分解既服务用户维护，也服务压缩与归档策略。

## Capabilities

### New Capabilities
- `storage-footprint-breakdown-and-heavy-object-finder`: 定义存储体积分解、重对象发现和清理前提示。

### Modified Capabilities
- `storage-compaction-archive-vacuum-and-retention-preview`: 需要消费重对象信息。
- `data-and-storage`: 需要支持对象级体积元数据。
- `workspace-home-and-operating-cockpit`: 可选展示轻量体积风险提示。

## Impact

- Backend：会影响体积统计、对象元数据和重对象查询。
- Frontend：会影响维护视图和清理建议卡片。
- Dependencies：这条线把 `c540` 做得更可操作，不只是“能整理”，而是“知道先整理谁”。
