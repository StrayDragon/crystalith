## 1. Validation baseline

- [x] 1.1 为所有 canonical specs 的每条 Requirement 补齐至少一个 `#### Scenario:`（WHEN/THEN）。
- [x] 1.2 统一 Requirement 文本使用 MUST/SHALL/MUST NOT（消除 SHOULD/非规范性语句导致的校验失败）。

## 2. Workspace UI consolidation

- [x] 2.1 保留 `workspace-ui-core` 并补齐场景。
- [x] 2.2 新增 `workspace-ui-panels`，收敛 Sources/Chat/Studio/Analysis/Research/Citations 的面板契约。
- [x] 2.3 移除已合并的旧 UI specs：`workspace-ui-{sources,chat,studio,analysis,research-and-citation}`。

## 3. Index & mapping

- [x] 3.1 更新 `openspec/specs/README.md`：canonical reading order 与 Old -> New 映射。

## 4. Verification

- [x] 4.1 `openspec validate --specs --json`（全部通过）
- [x] 4.2 `openspec list --specs --json`（仅保留 21 个 canonical specs，包含 `workspace-ui-panels`）
