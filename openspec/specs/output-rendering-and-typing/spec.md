# output-rendering-and-typing Specification

## Purpose

定义输出在前端的类型建模与渲染契约：typed payload 判别联合、运行时 guard、通用渲染器与回退路径。

## Non-goals

- 不定义后端生成算法
- 不定义具体业务工具内容

## Requirements

### Requirement: Output payload is modeled as discriminated union
前端 MUST 以 `output.type` 作为判别字段建模 payload，保证类型 narrowing 可用。

### Requirement: Runtime decode provides safe fallback
运行时 decoder/guard MUST 在 shape 不匹配时回退到 raw/unknown 渲染，不得崩溃。

### Requirement: GenericOutputRenderer supports canonical layouts
通用渲染器 MUST 支持规范布局类型与字段描述符递归渲染。

### Requirement: RenderDescriptor contract is stable
workspace tools 返回的 `render_descriptor`/`config_schema` 字段语义 MUST 稳定。

### Requirement: Rendering priority is deterministic
渲染优先级 MUST 为 专用插件 > GenericOutputRenderer > Raw JSON。
