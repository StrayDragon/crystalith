## Context

当前 canonical specs 的多数 Requirement 缺少可验证场景，导致 `openspec validate --specs` 大面积失败；这会进一步阻塞 OpenSpec 的“变更归档 → 同步主规范”流程，使规范无法成为稳定的协作契约。

同时，Workspace UI 的交互契约分散在多个 `workspace-ui-*` spec 中，内容存在重叠（流式状态、取消、队列/终态、错误可恢复等），维护成本高。

## Goals / Non-Goals

**Goals:**
- 让所有 canonical specs 通过 `openspec validate --specs`（每条 Requirement 至少 1 个 `#### Scenario:`，Requirement 文本包含 MUST/SHALL/MUST NOT）。
- 以最小场景模板补齐验证点，避免文档膨胀。
- 将 Workspace UI 规范合并为 2 份：`workspace-ui-core`（顶层不变量）+ `workspace-ui-panels`（业务面板契约）。

**Non-Goals:**
- 不重写业务语义或引入新的功能需求。
- 不变更后端/前端实现或 API 合同（本变更为规格与索引的整理）。

## Decisions

- **Scenario 最小化**：每条 Requirement 只补齐 1 个最小场景（WHEN/THEN），用“可观察行为/结果”描述，不绑定具体实现细节。
- **规范性语言统一**：把 `SHOULD`（仅建议）改为 `MUST`（硬性契约）或移出 Requirement（本次选择前者以保留约束并通过校验）。
- **UI 规范收敛**：删除分散的 `workspace-ui-{sources,chat,studio,analysis,research-and-citation}`，将核心面板契约集中到 `workspace-ui-panels`，减少漂移面。

## Risks / Trade-offs

- [新增 Scenario 导致 spec 变长] → 采用最小场景模板，每条仅 2 行 WHEN/THEN，控制增量。
- [把 SHOULD 改为 MUST 可能显得更“强”] → 这些条目在实际迭代中已被视为必需约束；若后续确需降级为建议，可在独立变更中讨论并调整校验策略。

## Migration Plan

- 更新 `openspec/specs/**/spec.md` 与 `openspec/specs/README.md`。
- 通过 `openspec validate --specs` 验证后提交。
- 后续引用旧 UI spec 名称时，按 README 的 Old -> New 映射迁移到 `workspace-ui-panels`。

## Open Questions

- 是否将 `openspec validate --specs`（或 `--strict`）纳入 CI gate 作为硬性检查？
