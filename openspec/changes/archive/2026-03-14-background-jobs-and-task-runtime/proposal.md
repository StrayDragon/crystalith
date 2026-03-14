## Why

随着 Crystalith 支持的能力变多，越来越多操作会变成长时间任务：大批量导入、connector 同步检查、复杂研究流程、批量生成 outputs、长时间 slides 生成等。若继续依赖请求-响应式交互，会出现明显问题：

- 用户难以理解任务当前进度、是否可取消、是否可重试
- 前端需要为每个长流程单独做 loading / polling / error 模型
- 后端缺少统一的任务生命周期、重试和历史记录语义

因此，这个 proposal 关注的是一个 **background jobs and task runtime**，把长流程统一沉淀为后台任务模型。

## What Changes

- 新增后台任务模型：排队、运行中、成功、失败、取消
- 提供统一的进度事件、重试、取消与任务历史能力
- 把长时间流程逐步迁移到 task runtime，而不是各自实现异步状态机
- 前端统一消费任务状态与通知，而不是每个功能各做一套 polling/SSE

## Before / After

### 实现前
- 长任务状态分散在各个功能模块中
- 用户经常只能看到模糊 loading 或一次性报错
- 很难形成统一的任务历史和恢复体验

### 实现后
- 长任务都进入统一 runtime 管理
- 用户能查看任务进度、取消、重试和历史记录
- 新功能接入异步流程的成本显著降低

## 优点

- 是很多未来能力的公共底座
- 明显改善复杂任务的可观测性和可恢复性
- 能统一前后端的异步交互模型

## 风险与代价

- 属于基础设施工作，短期产品感不如直接做新功能
- 需要梳理现有 SSE / loading / polling 逻辑，迁移成本不低
- 若模型过重，可能拖慢简单任务的接入

## Capabilities

### New Capabilities
- `background-jobs-and-task-runtime`: 提供统一后台任务、进度事件、取消与重试能力

### Modified Capabilities
- `workspace-api-contract`: 需要暴露任务模型、状态查询和事件接口
- `workspace-shared-ui-state`: 需要统一任务状态在 UI 中的呈现
- `generation-observability-and-guardrails`: 需要把任务执行可观测性纳入现有观测体系

## Impact

- Backend
  - 新增任务运行时与任务状态存储
  - 长流程能力逐步迁移到统一任务框架
- Frontend
  - 新增任务中心、任务通知和通用进度组件
- Product
  - Crystalith 从“同步触发工具”演进为“可管理异步工作流的平台”
