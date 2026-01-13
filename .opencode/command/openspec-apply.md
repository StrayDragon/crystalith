---
description: Implement an approved OpenSpec change and keep tasks in sync.
---
The user has requested to implement the following change proposal. Find the change proposal and follow the instructions below. If you're not sure or if ambiguous, ask for clarification from the user.
<UserRequest>
  $ARGUMENTS
</UserRequest>
<!-- OPENSPEC:START -->
**护栏**
- 优先使用直接、最小的实现，仅在请求或明确需要时才添加复杂性。
- 保持变更紧密限制在请求的结果范围内。
- 如果您需要额外的 OpenSpec 约定或说明，请参阅 `openspec/AGENTS.md`（位于 `openspec/` 目录内——如果您看不到它，请运行 `ls openspec` 或 `openspec update`）。

**步骤**
将这些步骤跟踪为 TODO 并逐一完成。
1. 阅读 `changes/<id>/proposal.md`、`design.md`（如果存在）和 `tasks.md` 以确认范围和验收标准。
2. 按顺序完成任务，保持编辑最小化并专注于请求的变更。
3. 在更新状态之前确认完成——确保 `tasks.md` 中的每一项都已完成。
4. 在所有工作完成后更新检查清单，使每个任务标记为 `- [x]` 并反映实际情况。
5. 当需要额外上下文时，参考 `openspec list` 或 `openspec show <item>`。

**参考**
- 如果您在实施过程中需要提案的额外上下文，请使用 `openspec show <id> --json --deltas-only`。
<!-- OPENSPEC:END -->
