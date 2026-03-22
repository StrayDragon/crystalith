## Why

输出类型越多（briefing/timeline/quiz/slides…），渲染与模板就越容易分裂：同一种输出在不同页面、不同导出路径里长得不一样；模板升级时缺少版本与迁移边界，最后不是“不敢改”，就是“改了全线翻车”。

这份 change 希望把输出渲染做成一条可复用的管线：类型明确、模板可迁移、渲染可缓存、错误可解释。

## What Changes

- 收口输出类型与渲染器契约：
  - output type registry：每个输出类型必须声明 schema、renderer、可导出形态
  - renderer 输出必须能携带结构化错误（供 `c34` 展示恢复动作）
- 引入模板版本与迁移：
  - template 具备 `schema_version`，升级时提供迁移策略（不再靠“手改 JSON”）
  - 内置模板与用户模板的行为差异写清楚（覆盖/继承规则）
- 支持跨类型转换的稳定入口（引用 `cross-type-result-transformations`）：例如从 briefing 生成 slide outline。
- 与 bundle/插件拆分对齐：渲染器作为插件时，需要可追踪的 bundle 信息（为 `c38` 的性能门禁服务）。

## Capabilities

### New Capabilities

- `output-renderer-unification`: 输出类型 registry、renderer 契约与模板版本迁移规则。

### Modified Capabilities

- `output-rendering-and-typing`: 输出 schema/typing 与渲染结果的一致性要求。
- `studio-output-types`: studio 内各输出类型的表现与导出边界。
- `cross-type-result-transformations`: 跨类型转换的输入输出契约与错误表达。
- `fullstack-plugin-bundles`: 渲染器/输出插件的 bundle 拆分与可追踪性要求。

## Impact

- Backend：输出生成与渲染的边界更清楚；模板迁移会更像工程，而不是手工操作。
- Frontend：不同输出类型的渲染组件更可复用；导出路径（PDF/Slidev）也更容易统一。
- Dependencies：建议先把 `c11` 的 run 与 `c09` 的事件契约收口，输出渲染才能自然接入统一生命周期。

## Dependency Sketch

```mermaid
flowchart TD
  TYPE[Output type registry] --> SCHEMA[Typed schema]
  SCHEMA --> REND[Renderer]
  REND --> UI[UI render]
  REND --> EXP[Export (pdf/slidev)]
  TMPL[Template vN] --> REND
  TMPL --> MIG[Template migration]
```
