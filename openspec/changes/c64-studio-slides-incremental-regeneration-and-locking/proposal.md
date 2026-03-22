## Why

Slides 工作流是“半自动 + 半手工”的典型：模型生成一个初稿，人再做修改，再让模型补齐。现在最容易出问题的是两件事：手工改过的内容被覆盖、以及每次 regeneration 都像全量重做，既慢又不可控。

需要一个明确的“锁定 + 增量再生”契约，让 slides 真正变成可迭代的编辑资产。

## What Changes

- 定义 section locking：
  - 锁定的 section 不允许被 regeneration 覆盖（除非显式解锁）
  - 锁定状态必须随 output 保存，并在 UI 明确可见
- 定义增量 regeneration：
  - 支持只对选定 section/范围再生
  - 支持 regeneration preview（先看 diff 再应用）
- 与 run/SSE 对齐：
  - regeneration 作为 run 的一种类型（引用 `c11`）
  - 进度与错误通过统一 SSE envelope（引用 `c09`）

## Capabilities

### New Capabilities

- `studio-slides-incremental-regeneration`: slides section 锁定、增量再生与 preview/apply 契约。

### Modified Capabilities

- `studio-slides-workflow`: slides 的对象模型、编辑边界与再生入口。
- `slides-workflow-plugins`: slides 相关插件的输入输出契约（必须尊重锁定语义）。
- `workspace-shared-ui-state`: 锁定状态与增量再生的共享状态合并规则。
- `workspace-ui-panels`: UI 上的锁定/预览/应用交互要求。

## Impact

- Frontend：会新增一些交互与状态，但收益很直接：用户不会再害怕“点了再生就全没了”。
- Backend：需要把 regeneration 拆成更细粒度的任务单元，便于增量与取消。
- Dependencies：建议与 `c63` 的输出渲染统一一起推进，避免 slides 走一套独立渲染/导出逻辑。

## Dependency Sketch

```mermaid
flowchart LR
  EDIT[Manual edits] --> LOCK[Lock sections]
  LOCK --> RUN[Incremental regen run]
  RUN --> PREVIEW[Preview diff]
  PREVIEW --> APPLY[Apply changes]
  APPLY --> OUT[Slides output]
```
