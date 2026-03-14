## 背景

Crystalith 已经有越来越多需要异步执行的动作，但它们的生命周期、进度表达、取消方式和历史记录语义还没有被统一成稳定底座。继续让每条长链路各自维护状态，会让后续的生成、导入、同步检查和治理能力都不断复制同一套任务语义。

## 已确定决策

### D1：后台任务是通用运行时对象，不绑定单一业务流程
- 任务模型先回答“如何执行长任务”，不回答“具体业务要做什么”。
- 生成、导入、同步检查等流程都应复用同一套任务对象。

### D2：v1 固定统一生命周期
- v1 固定使用 `queued / running / succeeded / failed / cancelled` 五类状态。
- 不在本 change 中增加更细的调度阶段状态。

### D3：进度、事件与历史必须可查询
- 每个任务都需要稳定暴露当前状态、进度摘要、关键事件和最终结果摘要。
- 历史记录属于运行时语义的一部分，而不是日志系统的附属物。

### D4：取消与重试必须显式触发
- 取消和重试都是显式动作，而不是由前端自行重建请求。
- 重试语义基于“同一任务定义重新执行”，而不是复制一份新流程描述。

### D5：v1 不解决复杂调度策略
- 本次不定义优先级、公平性、配额或跨租户调度策略。
- 本次只把最小可复用运行时模型固定下来。

## 关键对象与边界

- `job`: 后台任务的稳定对象，包含类型、状态、进度、结果摘要和历史。
- `job event`: 任务执行过程中的关键状态变化和提示信息。
- `retry`: 对同一任务定义的重新执行动作。
- `cancel`: 对正在进行任务的显式停止动作。

## 已确定的具体定义

### Job 对象（最小公共字段集）

Job runtime 需要提供足够的信息让 UI/调用方统一展示与治理，但不承诺承载全部业务细节：

```yaml
Job:
  id: string
  type: string                 # 运行时分类（例如 generation/import/sync_check），可扩展
  status: enum                 # queued | running | succeeded | failed | cancelled
  created_at: time
  updated_at: time
  started_at: time | null
  finished_at: time | null
  progress:                    # 最小进度表达（可选）
    percent: float | null      # 0.0 ~ 1.0
    message: string | null     # 面向用户的短提示
    phase: string | null       # 业务可填充的阶段名（不进入状态机）
  result_summary: ResultSummary | null
  error_summary: ErrorSummary | null
  recovery_hint: string | null # 面向用户的恢复建议（与 ErrorSummary 可重复，方便 UI 直读）
  history: list[JobRun]        # 执行历史（attempt 维度）
```

### 状态集合与转移规则（v1）

- 状态集合固定为：`queued → running → (succeeded | failed | cancelled)`
- **允许的转移**：
  - `queued → running`
  - `running → succeeded | failed | cancelled`
  - `queued → cancelled`（排队取消）
  - `failed | cancelled → queued`（由 `retry` 触发，开始一次新 attempt）
- **不允许的转移**：
  - `succeeded → queued`（v1 不提供“重跑成功任务”的产品语义；需要的话未来引入 `rerun`）
  - 任意状态直接跳到 `succeeded` 之外的终态（必须经过 `running`，除非排队取消）

### 进度、事件与历史记录（最小公共模型）

- **Job progress**：以“百分比 + 短消息 + 可选 phase”表达，不将业务阶段写入状态机。
- **Job event**：用于记录关键节点与提示信息，支持 UI 渲染时间线：

```yaml
JobEvent:
  ts: time
  level: enum                  # info | warn | error
  kind: string                 # 例如 "started" | "checkpoint" | "hint" | "completed"
  message: string
  progress: Job.progress | null
```

- **JobRun（attempt）**：把“重试”落实为同一 job 下的多次执行历史：

```yaml
JobRun:
  attempt: int                 # 从 1 开始递增
  status: enum                 # queued | running | succeeded | failed | cancelled
  started_at: time | null
  finished_at: time | null
  events: list[JobEvent]
  result_summary: ResultSummary | null
  error_summary: ErrorSummary | null
```

### 取消、失败、重试：边界与幂等预期

- **cancel**
  - 仅对 `queued`/`running` 生效；对终态 job 的 cancel 请求应返回当前 job（幂等 no-op）。
  - 对 `queued` 的 cancel 可以直接转为 `cancelled`；对 `running` 的 cancel 表示“请求停止”，最终以 `cancelled` 终态落地。
  - 重复 cancel 请求应幂等。
- **failed**
  - `failed` 表示本次 attempt 已结束且未成功；必须提供 `error_summary`，并尽量提供 `recovery_hint`。
  - `failed` 不自动触发重试；重试必须显式触发（D4）。
- **retry**
  - 仅允许在 `failed` 或 `cancelled` 后触发；触发后创建新 `JobRun`（attempt +1），job 回到 `queued`。
  - 若用户对同一 job 连续点击 retry，而最新 attempt 已在 `queued/running`，应返回当前 job（幂等 no-op），避免重复创建 attempt。

### 任务与业务流程的装配关系

```
JobDefinition（通用）
  ├── type: string        # "generation" | "import" | "sync_check" | "batch_generation"
  ├── params: dict        # 业务参数（传给具体执行器）
  └── executor: string    # 执行器标识

JobExecutor（按业务注册）
  ├── GenerationExecutor     → 消费 generation-core 管线
  ├── ImportExecutor         → 消费 source-connectors 导入流程
  ├── SyncCheckExecutor      → 消费 connector sync_check
  └── BatchGenerationExecutor → 批量编排多个 GenerationExecutor
```

**装配原则**：Job runtime 提供 lifecycle + progress + retry；具体业务逻辑由 Executor 实现。Job 不了解业务细节，Executor 不关心任务状态管理。

### 任务接口语义（运行时契约）

以下接口语义用于固定“调用方如何创建/查询/操作任务”的公共契约（具体路由命名可后置实现阶段决定）：

- **创建**：提交 `JobDefinition` 创建 job，返回 `job.id` 与初始 `status=queued`。
- **查询**：按 `job.id` 查询 job，返回状态、progress、当前 attempt 事件摘要、result/error summary 与 history 概览。
- **列表**：支持按 workspace/notebook（若适用）、type、status 过滤的 jobs 列表（UI 用于任务中心）。
- **取消**：对 `queued/running` job 发起 cancel；返回更新后的 job（cancel 幂等）。
- **重试**：对 `failed/cancelled` job 发起 retry；创建新 attempt 并返回更新后的 job（retry 幂等）。
- **历史**：查询 job 的 attempts 与关键事件时间线，便于复盘与治理。

### 结果摘要、错误摘要与恢复提示（结构化要求）

Job runtime 需要为 UI 提供“可读的最小摘要”，但不承诺把业务结果内容完全内嵌在 job 中：

```yaml
ResultSummary:
  title: string              # 面向用户的一句话摘要
  description: string | null # 可选补充
  primary_ref:               # 指向业务产物/对象的引用（供业务界面跳转）
    kind: string
    id: string
  refs: list[Ref] | null     # 其它相关引用（可选）

ErrorSummary:
  code: string               # 稳定错误码（可用于统计与提示分流）
  message: string            # 面向用户的错误描述
  recoverable: bool
  details: object | null     # 可选调试信息（不保证对用户稳定）
```

- `recovery_hint` 用于给出“下一步怎么做”的明确提示（例如“检查连接器授权后重试”“缩小导入范围”“稍后重试”）。
- 业务侧需要展示更丰富结果（例如导入 diff、生成内容预览）时，应通过 `primary_ref` 跳转到业务界面承接。

### 通用任务 UI vs 业务界面分工

| 功能 | 归属 |
|------|------|
| 任务列表、状态展示、进度条 | **通用任务 UI** |
| 取消、重试按钮 | **通用任务 UI** |
| 任务历史查看 | **通用任务 UI** |
| 生成结果预览/操作 | **业务界面**（Studio） |
| 导入范围选择/确认 | **业务界面**（Connector UI） |
| 同步检查 diff 展示 | **业务界面**（Connector UI） |

### 前端统一展示方式（v1）

- 在工作区提供“任务中心”入口（workspace 级），用于查看 jobs 列表与历史。
- 列表行最小展示：`type`、状态 pill、progress（percent + message）、更新时间、`result_summary.title` 或 `error_summary.message`。
- 行内动作：对 `queued/running` 显示取消；对 `failed/cancelled` 显示重试；对 `succeeded` 仅显示查看详情（v1 不提供重跑）。
- 详情页/侧栏展示：
  - attempt 列表与关键事件时间线（JobEvent）
  - 结果摘要或错误摘要 + recovery_hint
  - 若有 `primary_ref`，提供“打开业务结果”的跳转按钮

### 任务历史的入口与范围

- **入口**：workspace 级“任务中心”是主入口；业务界面可在特定对象页提供“查看关联任务”快捷入口（可选）。
- **范围**：默认展示当前 workspace 的 jobs，并允许按 notebook/type/status 过滤（若概念存在）。
- **保留**：v1 只要求历史可查询，不在本 change 中固定保留周期策略。

### 复核：生成 / 导入 / 同步检查是否共享同一模型

- **generation**：`JobDefinition.type="generation"`，`primary_ref` 指向生成结果对象；progress 可表达“检索/生成/后处理”阶段但不写入状态机。
- **import**：`type="import"`，`primary_ref` 指向某次导入批次；业务界面承接范围选择与结果预览。
- **sync_check**：`type="sync_check"`，`primary_ref` 指向同步检查报告；业务界面承接 diff 展示与下一步动作。

上述三类都只需要 job runtime 提供统一 lifecycle/progress/events/history/retry/cancel，即可共享同一底座。

### 后置项说明

- D5 中的"优先级、公平性、配额或跨租户调度策略"后置条件：**确认需要但延迟到多租户场景出现后**

## 非目标

- 不在本 change 中统一所有业务工作流本身。
- 不要求一次性迁移所有现有异步能力。
- 不在本 change 中定义复杂的调度公平性与容量治理策略。
