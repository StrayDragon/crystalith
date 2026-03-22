## Why

workspace 前端已经有不少 store、hooks、overlay、输出渲染。这个阶段最容易出现的性能问题不是“真的很慢”，而是：

- 某次操作突然卡一下，但复现不稳定
- 加了一个字段，结果整个页面大量 rerender
- 大 workspace（很多 sources/outputs）时 UI 变得脆弱

这条提案的目标是把“性能”从玄学变成约束：有预算、有检查、有定位手段。

## What Changes

- Zustand 使用约定（先写规则，再慢慢扫）：
  - 组件只订阅最小 selector，禁止直接订阅整个 store
  - derived state 必须 memo（避免 render 中重复计算）
  - store slice 划分：domain 状态与 UI 壳层状态分开
- DEV 期诊断工具（只在 dev 打开）：
  - 渲染计数（哪些组件频繁 render）
  - 关键交互的 performance marks（打开 overlay、切 tab、渲染 outputs）
- 设一个朴素预算（可调）：
  - 关键交互的主线程阻塞/渲染耗时不超过阈值
  - 超过阈值必须能在 dev 工具里看到“是谁拖慢的”
- 与现有路线对齐：
  - 预算/marks 复用 `c2013/c38` 的 vitals gate 方向，但先从本地 dev 诊断开始

## Capabilities

### New Capabilities

- `frontend-state-performance-budget-and-selector-guidelines`: selector 规则、dev 诊断与预算门禁。

### Modified Capabilities

- `frontend-performance-marks-and-web-vitals-gates`: marks 与预算可以合并维护。（`c2013`）
- `large-workspace-performance-and-capacity-management`: 大 workspace 压力场景需要同一套指标。（`c36`）

## Impact

- Frontend：性能问题更可定位，迭代更安心。
- Risk：规则太多会让开发体验变差；所以先从“新增代码必须遵守”开始，再慢慢扫旧代码。

## Dependency Sketch

```mermaid
flowchart TD
  Store[Zustand store] --> Sel[Selectors]
  Sel --> Comp[Components]
  Comp --> Marks[Perf marks (DEV)]
  Marks --> Budget[Budget checks]
  Budget --> Report[Slow path report]
```
