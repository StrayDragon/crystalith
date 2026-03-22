## Why

我们现在不缺提案，甚至可以说提案太多了：既有 c00~c06 这条“产品主线”，也有 c2000+ 这批“工程细节提案”。问题是它们更像一张巨大的菜单——点菜很爽，但很难形成一顿能吃饱的套餐。

这份 change 想做一件朴素的事：把“先做什么、做完算什么、下一步怎么接”说清楚，让后面的提案都能顺着一条路走，不再每次讨论都从头讲边界。

## What Changes

- 引入“Slice（推进切片）”的写法约定：每个 slice 只回答三件事——最小闭环交付、依赖项、退出条件（怎么验证它真的完成了）。
- 把当前的工程型提案收敛成几条可并行推进的主线，并明确它们之间的依赖关系：
  - 基础契约（对象/ID/事件）
  - 运行时与流式（run 生命周期、SSE 事件）
  - 可观察性与诊断（关联 ID、日志/指标/trace、诊断台）
  - 质量与可复现（检索调试、评测中心、repro pack）
  - 体验与性能（错误恢复、性能门禁、背压可视化）
  - 内容与工作流（ingestion、connector 诊断、prompt/template、slides、citations、commands）
- 约定“退出条件”的最低标准：至少包含可执行命令、可见 UI/接口信号、以及失败时的定位线索（例如 correlation_id）。
- 给本仓库的编号策略一个落点：优先级靠前的 slice 放在 c07~c39；更细的专项继续在 c2000+ 生长，但要能被 slice 引用（而不是平行造轮子）。

## Capabilities

### New Capabilities

- `engineering-roadmap-slices`: slice 的结构、依赖表达方式、退出条件模板，以及如何引用其它 changes/specs。

### Modified Capabilities

- `architecture-core`: 增加“slice 作为推进单位”的约定，以及依赖图在仓库内的维护方式。
- `quality-and-regression`: 把“退出条件”落到可执行的质量门禁（至少覆盖 `just llm-eval`、`pnpm run api:sync`、drift check 一类动作）。
- `delivery-and-deployment`: 约定 slice 完成后的必跑清单（例如 schema/openapi/client 的生成与校验）。

## Impact

- Docs：后续 change 会更好找、更好排期；讨论会更聚焦——只围绕“最小闭环”和“退出条件”。
- Execution：这份提案本身不引入实现，但它会把已有提案串成能推进的队列，减少重复劳动。

## Dependency Sketch

```mermaid
flowchart TB
  subgraph P["Product Spine (existing)"]
    C00[c00 Object model & readiness] --> C01[c01 First-run success]
    C00 --> C02[c02 Recipe workflows]
    C02 --> C03[c03 Source readiness hub]
    C04[c04 Evidence gap] --> C05[c05 Quality scorecards]
    C05 --> C06[c06 Knowledge packs]
  end

  subgraph E["Engineering Slices (new)"]
    C08[c08 Domain IDs] --> C09[c09 SSE contract] --> C11[c11 Run lifecycle]
    C11 --> C12[c12 Observability bundle] --> C30[c30 Dev diagnostics]
    C12 --> C26[c26 Retrieval debug] --> C27[c27 Eval center] --> C28[c28 Repro packs]

    C14[c14 Config profiles] --> C17[c17 Degraded mode] --> C18[c18 Maintenance tooling]

    C31[c31 DB hygiene] --> C32[c32 OpenAPI/SDK gates]
    C34[c34 Error UX] --> C38[c38 Web vitals]
    C39[c39 Backpressure] --> C38
  end

  subgraph W["Workflow Slices (new)"]
    C54[c54 Ingestion contracts] --> C56[c56 Connector preflight]
    C54 --> C26

    C62[c62 Prompt preset lineage] --> C27

    C63[c63 Output renderer] --> C64[c64 Slides incremental regen]
    C63 --> C67[c67 Citation review]
    C67 --> C27

    C66[c66 Command routing] --> C11
    C68[c68 Doc governance] --> C32
  end

  C00 --> C08
  C01 --> C34
  C03 --> C26
```
