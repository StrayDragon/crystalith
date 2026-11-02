---
depends_on:
  - c139-wire-parser-plugins
---

# output-type 内建迁入 CrystalithPlugin（仍不对 npm 开）

本草案不实现。落实时走完整 propose。排在 parser 对外（c139）之后，避免两条插件面并行改。

## Why

- architecture-plugin-and-agent r16 把 `OUTPUT_META` → `CrystalithPlugin` 标成 DEFERRED，并禁止第三套平行注册表。
- studio-output-types r305 要求工具列表由 `/v2/workspace/tools` 动态驱动；generation-core r166 却写死「静态注册表、不依赖外部插件」——合约打架。
- 现有六种产出（FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING）产品够用；web 只加载 `kind: 'builtin'` 的 frontendBundle。为证明可扩展而对外开，会把接口朝假需求腐烂。

## What Changes（正式化时）

分两段，本草案只覆盖第一段：

1. **内建统一（本草案的范围）**
   - 把 `OUTPUT_META` + `FRONTEND_BUNDLES` 收成 builtin `kind: 'output-type'` 插件，经同一 registry 注册。
   - 改写 r166：未知类型仍 400，`supported` 来自 registry，而不是写死静态对象；消掉与 r305 的冲突。
   - 对外承诺不变：官方内建，**不接** `@crystalith-plugin/*` 的 output-type。
   - web 继续只认 `kind: 'builtin'`。

2. **对外开放（明确不在本草案）**
   - 触发条件：web 有 `kind: 'external'` 加载协议（版本、隔离、失败回退），**并且**出现现有六种表达不了、反复出现的真实产出。
   - 外部包还要自带 Zod schema + postprocess + 交互 viewer——三面契约，现缺宿主。

## 非目标

- 不把 TextFold 做成第七种 outputType（折叠是阅读层，见 c141）。
- 不在本阶段设计远程 bundle 加载。
- 不改 QA/slides 的 generationType 边界。

## Open Questions

- schema SSOT：外部类型若永远不开，builtin 的 Zod 继续放 `packages/shared` 即可；若预留口子，要不要允许 plugin `configSchema` 兼作 output content schema（易与配置 schema 撞名）。
- 六种 interactive viewer 是否保持 web 内建 re-export，还是改成「每个 output-type 插件声明 frontendBundle id、web 侧静态 map」——后者已是现状，迁移时可能只是换注册处。
