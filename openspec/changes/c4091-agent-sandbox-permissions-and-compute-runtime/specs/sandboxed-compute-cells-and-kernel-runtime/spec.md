# sandboxed-compute-cells-and-kernel-runtime 规范增量

## ADDED Requirements

### Requirement: Compute Cells MUST Execute Through the Unified Execution Plane
系统 MUST 让 compute cell 通过统一 execution policy 与后台任务运行时执行，而不是作为 Notebook 内部的旁路脚本能力。

#### Scenario: 用户运行一个 compute cell
- **WHEN** 用户在 Notebook 中触发某个 compute cell
- **THEN** 系统 SHALL 先对该 cell 所需动作和资源做 policy evaluation
- **AND** SHALL 将该执行提交到受控的 compute runtime / background job 链路
- **AND** SHALL 让用户看到排队、运行、完成或失败等稳定状态

### Requirement: Compute Results MUST Be Reusable as Typed Notebook Outputs
系统 MUST 让 compute 结果以 typed outputs 的形式回挂到 Notebook，而不是只返回一次性文本。

#### Scenario: compute cell 成功产出结构化结果
- **WHEN** 某个 compute cell 成功完成
- **THEN** 系统 SHALL 至少支持将结果表达为 block payload、table、chart-ready dataset 或 artifact ref
- **AND** 后续 block、agent step 或 review 流程 SHALL 能引用这些 typed outputs

### Requirement: Compute Runtime MUST Surface Sandbox and Runtime Failures Distinctly
系统 MUST 区分 sandbox policy 拒绝、资源超限和 kernel/runtime 执行失败，而不是把所有失败折叠成同一类错误。

#### Scenario: compute cell 运行失败
- **WHEN** 某个 compute cell 因权限、资源或运行时错误而终止
- **THEN** 系统 SHALL 返回稳定的失败分类
- **AND** SHALL 提供可读的恢复提示，说明是需要提权、缩减资源还是修正执行内容
