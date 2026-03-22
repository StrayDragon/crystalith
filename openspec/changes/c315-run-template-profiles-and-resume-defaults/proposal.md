## Why

用户一旦开始反复跑同类任务，就会想把一套默认参数和恢复偏好固定下来。没有 run 模板档位，每次都从头配一次，长任务的使用门槛会一直偏高。

## What Changes

- 定义 run template profile，把常用目标、步骤粒度、来源策略和接管偏好收成模板。
- 支持 resume default，决定任务被恢复时默认走哪条路径。
- 区分一次性模板和长期模板，避免工作台里堆一堆僵掉的模板。
- 让 run 模板既能从已有 run 反向提炼，也能在启动前直接选用。

## Capabilities

### New Capabilities
- `run-template-profiles-and-resume-defaults`: 定义 run 模板档位、恢复默认项和模板生命周期。

### Modified Capabilities
- `agentic-research-runs`: run 启动和恢复需要消费模板档位。
- `research-plan-and-execution-checklists`: 计划需要能成为模板输入。
- `workspace-api-contract`: 需要增加 run 模板与恢复默认接口。

## Impact

- Backend：会影响模板对象、恢复偏好和启动装配。
- Frontend：会影响 run 启动器、恢复提示和模板管理。
- Dependencies：这条线是 `c320` 的继续补件，把“恢复”变得更像可配置路径。
