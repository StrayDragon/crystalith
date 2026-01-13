---
description: Scaffold a new OpenSpec change and validate strictly.
---
The user has requested the following change proposal. Use the openspec instructions to create their change proposal.
<UserRequest>
  $ARGUMENTS
</UserRequest>
<!-- OPENSPEC:START -->
**护栏**
- 优先使用直接、最小的实现，仅在请求或明确需要时才添加复杂性。
- 保持变更紧密限制在请求的结果范围内。
- 如果您需要额外的 OpenSpec 约定或说明，请参阅 `openspec/AGENTS.md`（位于 `openspec/` 目录内——如果您看不到它，请运行 `ls openspec` 或 `openspec update`）。
- 识别任何模糊或不清楚的细节，并在编辑文件之前提出必要的后续问题。
- 不要在提案阶段编写任何代码。仅创建设计文档（proposal.md、tasks.md、design.md 和规范增量）。实施在批准后的应用阶段进行。

**步骤**
1. 查看 `openspec/project.md`，运行 `openspec list` 和 `openspec list --specs`，并检查相关代码或文档（例如，通过 `rg`/`ls`）以使提案基于当前行为；注意任何需要澄清的差距。
2. 选择唯一的动词前缀 `change-id`，并在 `openspec/changes/<id>/` 下创建 `proposal.md`、`tasks.md` 和 `design.md`（需要时）的脚手架。
3. 将变更映射到具体的功能或要求，将多范围工作分解为具有清晰关系和排序的不同规范增量。
4. 当解决方案跨越多个系统、引入新模式或在提交规范之前需要权衡讨论时，在 `design.md` 中捕获架构推理。
5. 在 `changes/<id>/specs/<capability>/spec.md`（每个功能一个文件夹）中起草规范增量，使用 `## ADDED|MODIFIED|REMOVED Requirements`，每个要求至少包含一个 `#### Scenario:`，并在相关时交叉引用相关功能。
6. 将 `tasks.md` 起草为有序的小型、可验证的工作项列表，提供用户可见的进度，包括验证（测试、工具），并突出依赖项或可并行化的工作。
7. 使用 `openspec validate <id> --strict` 进行验证，并在共享提案之前解决每个问题。

**参考**
- 当验证失败时，使用 `openspec show <id> --json --deltas-only` 或 `openspec show <spec> --type spec` 检查详细信息。
- 在编写新要求之前，使用 `rg -n "Requirement:|Scenario:" openspec/specs` 搜索现有要求。
- 使用 `rg <keyword>`、`ls` 或直接文件读取探索代码库，以便提案与当前实现现实保持一致。
<!-- OPENSPEC:END -->
