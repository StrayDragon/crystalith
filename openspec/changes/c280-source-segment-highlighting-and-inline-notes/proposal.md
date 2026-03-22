## Why

用户读来源时，不只是想“看完”，还想顺手标记一段、记一句话、留下一个待验证点。现在这些行为大多要跳回 notebook 或另开对话，来源阅读本身还不够像工作面。

## What Changes

- 定义 source segment highlighting，让用户可直接标记来源中的关键片段。
- 支持 inline notes，把简短判断或待查点挂在来源片段旁边。
- 允许高亮与批注回写到 notebook、briefing 组装板或 evidence map。
- 保持批注与来源锚点稳定关联，避免后续刷新后完全断开。

## Capabilities

### New Capabilities
- `source-segment-highlighting-and-inline-notes`: 定义来源片段高亮、行内批注和回写语义。

### Modified Capabilities
- `citation-span-normalization-and-source-anchoring`: 需要支持用户侧片段锚点。
- `source-coverage-and-evidence-map`: 批注与高亮需要能进入证据地图。
- `workspace-ui-panels`: 来源详情需要承载阅读态高亮和批注。

## Impact

- Backend：会影响来源片段锚点、批注存储和回写关联。
- Frontend：会影响来源阅读器、高亮交互和批注边栏。
- Dependencies：这条线站在 `c230` 上面，让来源阅读从“看”变成“顺手处理”。
