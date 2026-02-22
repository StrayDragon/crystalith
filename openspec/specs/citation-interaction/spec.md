# citation-interaction Specification

## Purpose

定义 citations 的前端交互：引用标记的悬停预览、点击跳转到来源位置/详情的导航行为，以及引用数据加载与错误提示的最小体验要求。

## Related specs

- `GLOSSARY.md`
- `workspace-chat-ui/spec.md`
- `workspace-sources-ui/spec.md`
- `output-rendering/spec.md`

## Requirements
### Requirement: Citation Hover Preview

系统 SHALL 在用户悬停引用标记时显示 Tooltip 预览（包含引用片段文本与来源名称）。引用内容需要从 API 获取时 Tooltip MUST 显示加载指示器并在完成后显示内容。

### Requirement: Citation Click Navigation

系统 SHALL 支持点击引用标记跳转到原文位置：打开对应来源详情面板；如支持位置信息则滚动定位并高亮引用片段。
