## Why

RAG 的问题往往不是“完全错”，而是“差一点”：引用不稳、检索没命中、rerank 看不懂、缓存命中与否导致结果飘。现在我们能做的排查手段还是偏工程师视角（翻日志、开 debug 开关），对产品和迭代都太慢。

我们需要一个检索调试工作台：把一次生成背后的检索过程变成可查看、可比较、可复放的对象。

## What Changes

- 引入 `retrieval_snapshot_id`：每次生成/回答的检索装配过程都能产出一个快照 ID（可选持久化）。
- 明确快照内容（最小但够用）：
  - 原始 query、query rewrite（如有）、过滤条件
  - 候选来源列表（source/chunk）、向量检索分数、rerank 分数与排序
  - 最终进入上下文的片段列表 + citation 绑定结果
  - cache 命中信息（例如 assembly cache on/off、TTL、hit/miss）
- 提供 Debug View：
  - UI：在结果旁边打开“检索过程”，能看见为什么选了这些来源、哪些被丢弃、丢弃原因是什么。
  - API：按 snapshot_id 拉取快照，支持对比两个快照（为 `c27` 做铺垫）。
- 与可复现打通：snapshot_id 能被打包进 repro pack（见 `c28`），用于 deterministic replay。

## Capabilities

### New Capabilities

- `retrieval-debug-workbench`: 检索快照、调试视图、对比与复放的契约。

### Modified Capabilities

- `retrieval-and-cache`: 快照字段、cache hit/miss 的可解释输出要求。
- `output-rendering-and-typing`: 引用与上下文片段在 UI 的展示要求（能点回原 source）。
- `workspace-ui-panels`: Debug View 的入口、权限与信息密度控制。
- `quality-and-regression`: 快照对比与回放作为回归检查的输入之一（与 `c27`/`c28` 联动）。

## Impact

- Backend：需要定义 snapshot 的存储结构与输出接口；与现有 `CRYSTALITH_RETRIEVAL_ASSEMBLY_CACHE*` 开关对齐。
- Frontend：增加一个“解释与回溯”的面板；对开发/评测都能复用。
- Dependencies：建议先收口 `c12` 的 correlation_id 与诊断字段，再把 snapshot 与排障链路连起来。

## Dependency Sketch

```mermaid
flowchart LR
  Q[Query] --> RW[Rewrite (optional)]
  RW --> VEC[Vector search]
  VEC --> RR[Rerank]
  RR --> ASM[Context assembly]
  ASM --> CIT[Citation binding]
  CIT --> SNAP[retrieval_snapshot_id]
  SNAP --> UI[Debug View / Compare]
```
