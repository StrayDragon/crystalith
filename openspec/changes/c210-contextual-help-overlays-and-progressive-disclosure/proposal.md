## Why

工作台越强，越容易有一种反效果：新人不知从哪开始，老用户也不一定记得每个高级入口藏在哪。帮助如果只是文档链接，很多时候是来不及的；如果一直贴满解释，又会碍事。

## What Changes

- 定义 contextual help overlay，在关键位置给出刚好够用的上下文说明。
- 支持 progressive disclosure，让高级说明和复杂配置按需展开，而不是默认全露。
- 区分首次使用帮助、久未使用帮助和高级功能提醒，不做一刀切提示。
- 让帮助内容直接挂在对象和动作上，而不是漂在界面外面。

## Capabilities

### New Capabilities
- `contextual-help-overlays-and-progressive-disclosure`: 定义上下文帮助浮层、渐进披露和帮助分层语义。

### Modified Capabilities
- `first-run-success-path`: 首次帮助需要与渐进披露共享边界。
- `workspace-ui-core`: 需要支持上下文帮助浮层和记忆已看状态。
- `workspace-command-palette-and-shortcuts`: 高级命令需要能被帮助系统解释。

## Impact

- Frontend：会影响帮助入口、浮层、提示状态和已读逻辑。
- Backend/API：如帮助文案可配置，会影响帮助元数据接口。
- Dependencies：这条线和 `c205` 一起，补的是“会用”和“会回来再用”之间的断层。
