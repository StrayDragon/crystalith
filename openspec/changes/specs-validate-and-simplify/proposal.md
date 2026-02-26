## Why

当前 `openspec/specs/**/spec.md` 的多数规范缺少可验证的 `Scenario`，并混用 `SHOULD`/非规范性语句，导致 `openspec validate --specs` 无法作为可靠的质量门槛；同时也会阻塞基于 OpenSpec 的变更归档与规范同步（`openspec archive` 在重建规范时会校验失败）。

此外，Workspace UI 规范在多个 `workspace-ui-*` spec 中分散，维护成本高且边界重复，难以在迭代中保持一致。

## What Changes

- 为所有 canonical specs 的每条 Requirement 补齐至少一个 `#### Scenario:`（WHEN/THEN），并统一使用 MUST/SHALL/MUST NOT 的规范性语言。
- 合并 Workspace UI 规范：保留 `workspace-ui-core`（顶层不变量），新增 `workspace-ui-panels`（各业务面板最小契约），移除其余已合并的 `workspace-ui-*` 规范目录。
- 更新 `openspec/specs/README.md` 的 canonical reading order 与旧名称映射，使其反映当前真实 spec 列表。

## Capabilities

### New Capabilities

- `workspace-ui-panels`: Workspace 业务面板（Sources/Chat/Studio/Analysis/Research/Citations）的最小 UI 契约。

### Modified Capabilities

- `architecture-core`: 补齐每条 Requirement 的场景，明确结构约束的可验证入口。
- `architecture-plugin-and-agent`: 补齐场景并将兼容性门禁要求规范化为 MUST。
- `config-and-models`: 为缺失场景的要求补齐验证场景。
- `data-and-storage`: 将批量检索能力规范化为 MUST，并补齐场景。
- `delivery-and-deployment`: 为缺失场景的要求补齐验证场景。
- `generation-core`: 补齐每条 Requirement 的场景。
- `generation-observability-and-guardrails`: 补齐每条 Requirement 的场景。
- `openapi-and-client-generation`: 补齐每条 Requirement 的场景。
- `output-rendering-and-typing`: 补齐每条 Requirement 的场景。
- `quality-and-regression`: 将本地 guardrail 要求规范化为 MUST，并补齐场景。
- `retrieval-and-cache`: 补齐每条 Requirement 的场景。
- `source-ingestion-core`: 补齐每条 Requirement 的场景。
- `source-ingestion-management-and-tags`: 将 epoch-cached 要求规范化为 MUST，并补齐场景。
- `source-ingestion-summary-and-conversion`: 补齐每条 Requirement 的场景。
- `source-ingestion-upload-and-url`: 补齐每条 Requirement 的场景。
- `studio-output-types`: 补齐每条 Requirement 的场景。
- `studio-slides-workflow`: 补齐每条 Requirement 的场景。
- `workspace-api-contract`: 补齐每条 Requirement 的场景。
- `workspace-ui-core`: 补齐每条 Requirement 的场景，并将面板细节收敛到 `workspace-ui-panels`。

## Impact

- 规范维护：`openspec validate --specs` 可作为基础门槛使用，后续 `openspec archive` 不再需要 `--skip-specs` 才能归档。
- 读写体验：Workspace UI 规范数量减少，避免跨文件重复与漂移。
- 运行时：不改变后端/前端代码行为，仅规范文档与索引结构变化。
