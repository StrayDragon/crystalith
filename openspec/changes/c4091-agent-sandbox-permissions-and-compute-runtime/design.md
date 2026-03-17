## Context

当前仓库已经分别出现了两个需求方向：一类是 agent 工具越来越接近可执行系统动作，需要明确工具、对象和风险动作的授权边界；另一类是 Notebook 需要 compute cell 承担结构化处理、统计和轻脚本计算。两者若分别定义，会重复发明权限模型、资源配额、提权流程和审计记录。

这个合并变更把它们收敛为同一个 execution plane：所有可执行动作都先落到统一 policy 与 sandbox contract，再由不同消费方（agent tool、compute cell）映射成各自的 UX 与运行时。

## Goals / Non-Goals

**Goals:**

- 定义单一 execution policy contract，统一覆盖 tool actions 和 compute cell execution
- 定义提权审批后的临时授权 lease，而不是永久角色变更
- 定义 compute cell 如何通过后台任务运行时执行、恢复并产出结构化结果
- 定义 compute outputs 如何回挂到 Notebook block model 并被后续步骤引用

**Non-Goals:**

- 不在本变更里决定多语言 kernel 全量支持矩阵
- 不在本变更里展开具体 UI 视觉细节或最终组件树
- 不在本变更里定义离线同步、跨设备冲突解决或 DLP 外发策略

## Decisions

### 1. 统一 execution policy，避免 tool sandbox 与 compute sandbox 分叉

- 所有执行请求都先映射成统一的 `subject + action + object + sandbox_profile`
- policy evaluation 先计算 baseline permission，再叠加 tenant / environment policy，最后叠加临时授权 lease
- compute cell 不再维护独立的“计算白名单配置”；它直接消费相同 policy contract

备选方案是为 compute 单独定义一套 kernel policy。这个方案短期更快，但会导致 agent tool 和 compute cell 对网络、文件和 secrets 的语义不一致，后续无法统一审计和审批，因此放弃。

### 2. 提权使用短期 lease，而不是修改长期角色

- 高风险动作先生成 approval-backed elevation request
- 审批通过后产出带 scope、TTL 和 usage boundary 的临时 lease
- lease 只对指定 run / workspace / action set 生效，并要求审计记录引用同一 decision id

备选方案是审批后把用户或 workspace 角色直接升级。该方案回滚粗糙且难以审计，因此不采用。

### 3. compute cell 运行在 background job substrate 上，但必须声明资源与产物 contract

- compute-class jobs 必须声明 resource profile、sandbox profile 和可恢复 execution record
- job runtime 负责排队、取消、重试和事件历史；compute runtime 负责 kernel/session 生命周期和结果产出
- 长时计算不绕过后台任务系统，避免出现第二套 job lifecycle

### 4. 输出以 typed artifact refs 回挂，而不是只保留一次性文本

- compute 输出分成 stdout/stderr 摘要与 typed results
- typed results 至少支持 table、chart-ready dataset、generated block payload 和 artifact ref
- Notebook block 与后续 agent/run 步骤消费 typed refs，而不是重新从文本里解析

### 5. 迁移直接收口，不保留平行旧配置

- 新 proposal 明确要求统一 execution policy 成为唯一真相
- 旧的“工具权限配置”和“compute 沙箱配置”在实施时直接迁移到统一 model
- 不做长期双写或双配置兼容，避免治理面持续分叉

## Risks / Trade-offs

- [权限模型过重，导致低风险动作也需要复杂审批] → 用 risk tiers 与默认 baseline policy 把常见低风险动作留在无审批路径
- [compute 输出类型过多，导致 block model 复杂] → 先约束为少量稳定 typed result families，其他输出走 artifact ref
- [后台任务与 kernel 生命周期耦合过深] → job runtime 只负责外层生命周期，kernel/runtime 细节留在 compute executor 内部
- [统一策略收口影响已有实验配置] → 在实施阶段提供显式映射表，但不保留旧配置为长期入口

## Migration Plan

1. 先定义统一 execution policy schema 与 risk/elevation contract
2. 将 compute runtime 绑定到 background job substrate，并要求声明 sandbox/resource profile
3. 把 tool execution 与 compute execution 都迁移到统一 policy evaluator
4. 移除独立的旧式工具权限与 compute sandbox 配置入口

回滚边界：若实现阶段发现 unified policy 无法支撑 compute/runtime 基本路径，可回滚到 change 级别，不同步任何半成品 canonical spec；但不设计长期并存模型。

## Open Questions

- v1 compute cell 是否只支持单语言 runtime，还是允许多个 runtime 共享统一 sandbox contract
- typed results 的最小集合是否需要包含 dataframe-like schema，还是先统一抽象为 table/dataset
