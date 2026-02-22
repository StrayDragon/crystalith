# studio-guide Specification

## Purpose

定义 Studio 中 GUIDE 类型输出的学习路径展示：以模块卡片形式呈现，可勾选完成并显示整体进度，同时支持模块详情展开/折叠以平衡概览与细节。

## Related specs

- `GLOSSARY.md`
- `workspace-studio-ui/spec.md`
- `output-rendering/spec.md`
- `output-graph/spec.md`

## Requirements
### Requirement: 可勾选学习路径

系统 **MUST** 将指南呈现为可勾选的学习路径。
每个模块 MUST 显示为可勾选卡片（包含模块标题与目标摘要），勾选后 MUST 进入已完成状态。

### Requirement: 学习进度提示

系统 **MUST** 显示指南的整体完成进度。
用户勾选/取消模块时，进度提示 MUST 同步更新。

### Requirement: 模块折叠

系统 **MUST** 支持模块详情的展开与折叠。
用户点击模块标题或展开按钮时 MUST 展开详情（要点列表），再次点击 MUST 折叠收起。
