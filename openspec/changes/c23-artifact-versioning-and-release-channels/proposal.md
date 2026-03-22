## Why

有了正式 artifact、审批和外部分享以后，团队很快就会碰到一个很现实的问题：同一份产物到底哪版能给内部看，哪版能对外发，改过之后又该怎么追。只靠“最新结果”是不够的，发布对象必须有版本和渠道语义。

## What Changes

- 为 artifact 引入版本历史、release candidate、approved release、archived release 等正式状态，而不是只有一个当前态。
- 支持把同一份知识产物分配到不同 release channel，例如内部草稿、团队共享、外部发布、客户交付。
- 允许用户比较版本差异、查看每次发布的来源、审批记录和关联 briefing。
- 让外部分享、订阅简报和嵌入消费都能引用稳定版本，而不是总是指向最新草稿。

## Capabilities

### New Capabilities
- `artifact-releases-and-version-history`: 定义正式产物的版本链路、发布渠道和稳定引用能力。

### Modified Capabilities
- `publishable-artifacts`: 需要从“可沉淀”扩展到“可版本化、可比较、可按渠道发布”的生命周期语义。
- `evidence-review-workflow`: 需要明确审阅状态如何作用于候选版本与正式发布版本，而不是只作用于单个结果对象。
- `output-rendering-and-typing`: 需要支持稳定版本的渲染引用，而不是默认消费最新内容。
- `workspace-api-contract`: 需要增加版本列表、版本比较、release channel 和版本级引用接口。

## Impact

- Backend：artifact version store、差异摘要、channel 绑定和版本级访问控制。
- Frontend：版本时间线、版本对比视图、发布渠道配置和回滚入口。
- Product：这会让 Crystalith 的产物更接近真正可管理的“发布件”，而不是一次次生成结果。
- Dependencies：建议接在 `c06-publish-and-share-knowledge-packs`、`c09-external-share-portals`、`c14-approval-flows-and-audit-trails` 之后。
