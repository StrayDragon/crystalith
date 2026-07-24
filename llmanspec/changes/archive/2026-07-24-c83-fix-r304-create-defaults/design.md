# Design: c83 fix r304 create defaults

## Decision

| 项                      | 决                                        |
| ----------------------- | ----------------------------------------- |
| r304 默认               | **fix-spec-to-api**：对齐 c81（外网优先） |
| r311 progress           | **fix-spec**：列出已实现 SSE `progress`   |
| AsyncAPI / 注释         | 同 PR 文档对齐                            |
| 再改 validateCreateBody | **不需要**（已正确）                      |

## BREAKING（合约文案）

对仍按「省略 = 双 true」解读 r304 的读者：省略 `useNotebookSources` 现在明确为 **false**。运行时自 c81 起已如此。
