## Why

来源接入已经有了，但“这个来源现在能不能用、够不够新、提取得完整不完整”还不够直观。对研究型产品来说，这会直接影响用户是否敢继续往下问。

## What Changes

- 增加来源就绪度视图，展示解析状态、提取覆盖度、新鲜度和异常提示。
- 引入来源过期与再抓取建议，让“该不该刷新”变成一个明确动作。
- 支持按 source、source group 和 notebook 汇总来源健康状态。
- 为连接器来源补上同步策略、上次同步结果和失败恢复提示。

## Capabilities

### New Capabilities

- `source-readiness-and-freshness`: 定义来源可用性、新鲜度和再同步信号。

### Modified Capabilities

- `source-ingestion-core`: 需要暴露更多可诊断的就绪和失败语义。
- `knowledge-curation-and-freshness`: 需要把 freshness 从后台规则提升为用户可感知能力。
- `source-connectors`: 需要增加同步状态、同步提示和恢复动作的规范约束。
- `workspace-ui-panels`: Sources 面板需要承载来源健康信息和下一步动作。

## Impact

- Backend：来源元数据、同步状态、freshness 评估和再抓取调度。
- Frontend：Sources 面板、详情视图、状态标签和筛选能力。
- Dependencies：建议放在 `c00-workspace-object-model-and-readiness-contract` 和 recipe 之后推进，因为来源 readiness 最好挂在统一对象与状态语义上，workflow 成功率最终也取决于来源质量。
