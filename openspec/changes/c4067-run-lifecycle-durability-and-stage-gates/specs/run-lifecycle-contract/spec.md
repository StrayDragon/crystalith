# run-lifecycle-contract 规范增量

## ADDED Requirements

### Requirement: Run MUST Be a Stable First-class Object
系统 MUST 以稳定的 Run 对象表示长执行流程，并提供统一的创建、查询、取消与流式观察接口。

#### Scenario: 用户查看某次执行当前状态
- **WHEN** 用户请求某个 run 的详情
- **THEN** 系统 SHALL 返回稳定的 run 标识、状态、时间戳与上下文摘要
- **AND** SHALL 不要求用户直接理解底层 worker/task 细节

### Requirement: Stage Checkpoints MUST Be Represented on the Run Lifecycle
系统 MUST 将阶段检查点表示为 run 生命周期的一部分，而不是挂在孤立的 UI 临时状态上。

#### Scenario: run 在关键阶段等待确认
- **WHEN** 某个 run 到达需要人工确认的阶段
- **THEN** run 状态或其阶段摘要 SHALL 能表示当前正处于 checkpoint/gate
- **AND** 系统 SHALL 提供继续、回退或调整的下一步动作

### Requirement: Dry Run MUST Not Be Confused with Real Execution
系统 MUST 将 dry run / simulation 与真实执行分开表达，避免消耗和状态误解。

#### Scenario: 用户先查看执行预演
- **WHEN** 用户触发 run plan dry run
- **THEN** 系统 SHALL 返回模拟路径、风险与预计步骤
- **AND** SHALL 不把该 dry run 记录为真实执行成功或失败
