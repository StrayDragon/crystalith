# reading-packets-and-offline-review-bundles 规范增量

## ADDED Requirements

### Requirement: Review-oriented Artifact Slices MUST Be Packaged as Reading and Evidence Packets
系统 MUST 允许将总览审读与局部证据复核打包为 reading packets / evidence packets，而不是要求用户始终在线回切多个工作面。

#### Scenario: 用户准备离线审读某个主题或子问题
- **WHEN** 用户希望把 briefing、claims 或证据整理成可携带材料
- **THEN** 系统 SHALL 支持生成 reading packet 或 evidence packet
- **AND** 这些 packet SHALL 可嵌入更大的 offline review bundle

### Requirement: Offline Review Bundles MUST Keep a Return Path to Canonical Artifacts
系统 MUST 让 offline review bundles 在可带走的同时保留回链，而不是导出后变成无法回填的孤岛。

#### Scenario: 用户完成一轮离线复核后回到系统
- **WHEN** 用户基于 offline review bundle 做出标注、判断或续跑决定
- **THEN** 系统 SHALL 能将这些结果回接到对应 artifact、version 或 source context
- **AND** SHALL 保持 bundle 与 canonical objects 的关联关系
