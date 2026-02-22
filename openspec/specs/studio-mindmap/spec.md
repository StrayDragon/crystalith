# studio-mindmap Specification

## Purpose

定义 Studio 中 MINDMAP 类型输出的交互式只读视图：支持缩放/平移、节点折叠/展开与全局展开/折叠控制，用于快速理解概念层级结构。

## Related specs

- `GLOSSARY.md`
- `workspace-studio-ui/spec.md`
- `output-rendering/spec.md`
- `output-graph/spec.md`

## Requirements
### Requirement: 只读交互视图

系统 **MUST** 提供只读的思维导图交互视图。
视图 MUST 支持缩放与平移（滚轮/拖拽等交互）。

### Requirement: 节点折叠

系统 **MUST** 支持折叠与展开子节点。
用户点击带子节点的节点时 MUST 折叠其子树；再次点击 MUST 展开显示。

### Requirement: 全局折叠控制

系统 **MUST** 提供展开全部/折叠全部控制。
“折叠全部/展开全部”控制 MUST 分别收起/展开所有节点。
