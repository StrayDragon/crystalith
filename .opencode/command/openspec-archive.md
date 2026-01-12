---
description: Archive a deployed OpenSpec change and update specs.
---
<ChangeId>
  $ARGUMENTS
</ChangeId>
<!-- OPENSPEC:START -->
**护栏**
- 优先使用直接、最小的实现，仅在请求或明确需要时才添加复杂性。
- 保持变更紧密限制在请求的结果范围内。
- 如果您需要额外的 OpenSpec 约定或说明，请参阅 `openspec/AGENTS.md`（位于 `openspec/` 目录内——如果您看不到它，请运行 `ls openspec` 或 `openspec update`）。

**步骤**
1. 确定要归档的变更 ID：
   - 如果此提示已包含特定的变更 ID（例如在由斜杠命令参数填充的 `<ChangeId>` 块内），请在去除空格后使用该值。
   - 如果对话松散地引用变更（例如按标题或摘要），请运行 `openspec list` 以显示可能的 ID，分享相关候选，并确认用户打算使用哪个。
   - 否则，查看对话，运行 `openspec list`，并询问用户要归档哪个变更；在继续之前等待确认的变更 ID。
   - 如果您仍然无法识别单个变更 ID，请停止并告诉用户您还无法归档任何内容。
2. 通过运行 `openspec list`（或 `openspec show <id>`）来验证变更 ID，如果变更缺失、已归档或未准备好归档，则停止。
3. 运行 `openspec archive <id> --yes`，以便 CLI 在没有提示的情况下移动变更并应用规范更新（对于仅工具类的工作，请使用 `--skip-specs`）。
4. 查看命令输出以确认目标规范已更新，变更已落在 `changes/archive/` 中。
5. 使用 `openspec validate --strict` 进行验证，如果看起来有任何问题，请使用 `openspec show <id>` 进行检查。

**参考**
- 使用 `openspec list` 在归档前确认变更 ID。
- 使用 `openspec list --specs` 检查刷新的规范，并在移交之前解决任何验证问题。
<!-- OPENSPEC:END -->
