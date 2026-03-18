# agent-tool-permissions-and-sandbox-policy 规范增量

## ADDED Requirements

### Requirement: Agent Execution MUST Evaluate Subject, Action, and Object Scope Explicitly
系统 MUST 对 agent 执行动作显式求值 subject、action 与 object scope，而不是只按“某个工具可不可用”做粗粒度放行。

#### Scenario: agent 准备调用某个高风险工具动作
- **WHEN** 一个 agent run 准备执行某个 tool action
- **THEN** 系统 SHALL 基于调用主体、目标对象和动作类型做授权求值
- **AND** SHALL 能区分“可调用工具”与“可对哪个对象执行什么动作”这两个层次

### Requirement: Elevation MUST Be Granted as a Scoped Temporary Lease
系统 MUST 将高风险执行的提权表达为带 scope 和 TTL 的临时 lease，而不是把审批结果变成永久权限提升。

#### Scenario: 某次执行需要访问默认不允许的资源
- **WHEN** policy evaluator 判断该动作超出 baseline permission
- **THEN** 系统 SHALL 生成可审计的提权请求
- **AND** 审批通过后 SHALL 下发只对指定 scope 生效的临时 lease
- **AND** lease 过期或使用边界耗尽后 SHALL 自动失效

### Requirement: Sandbox Profiles MUST Govern Network, Filesystem, Time, and Secret Exposure
系统 MUST 用统一 sandbox profile 约束执行时的 network、filesystem、time、concurrency 和 secret exposure，而不是交由各执行器临时决定。

#### Scenario: 执行器装配一次受控运行环境
- **WHEN** 某个 agent tool 或 compute cell 准备启动执行
- **THEN** 系统 SHALL 为该执行绑定明确的 sandbox profile
- **AND** profile SHALL 定义出网、文件读写范围、执行时限、并发预算和 secrets 暴露边界
- **AND** 执行器 SHALL 不得绕过该 profile 私自扩大权限
