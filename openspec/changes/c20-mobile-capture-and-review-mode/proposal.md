## Why

很多真实使用场景不是坐在桌面前慢慢整理，而是看到一篇文章、听到一个判断、临时想补一条来源，或者在会前用手机快速看一下审阅状态。现在 Workspace 的核心价值已经有了，移动端还没真正成立。

## What Changes

- 提供 mobile-first 的 capture and review mode，让用户能在手机上完成来源采集、快速查看、轻量审阅和分享反馈。
- 支持更适合小屏幕的导航、面板切换、结果阅读和审批确认，而不是只把桌面布局硬缩小。
- 为移动场景补上 URL 快速导入、文件选择、图片/文档轻量接入和待处理队列。
- 把“会前快速看一下”“路上补一条来源”“手机上确认一次审批”做成正式场景。

## Capabilities

### New Capabilities
- `mobile-capture-and-review`: 定义移动采集、移动审阅和小屏协作模式。

### Modified Capabilities
- `workspace-ui-core`: 需要提供移动壳层、导航模式和小屏状态反馈基线。
- `workspace-ui-panels`: 需要支持面板折叠、上下文切换和移动优先的信息层级。
- `source-ingestion-upload-and-url`: 需要覆盖移动端来源导入、分享进入和轻量补充流程。
- `evidence-review-workflow`: 需要支持移动端快速确认、标记和回退，而不是默认桌面复杂交互。

## Impact

- Frontend：移动布局、触控交互、轻量入口、阅读模式和审批/审阅适配。
- Backend/API：上传约束、轻量接口、预览载荷和移动场景下的状态同步优化。
- Product：这会把 Crystalith 从“桌面工作台”拉到“随手可用的知识助手”。
- Dependencies：建议接在 `c03-source-readiness-and-freshness-hub`、`c08-multiplayer-review-workspace`、`c09-external-share-portals` 之后。
