# Design: c98 revision restore graph sync

> **状态**：薄设计 · Apply 在 `feat/c98-revision-restore-graph-sync`

## 恢复流

```
POST …/revisions/:revId/restore 成功
  → loadRun(notebookId, rid)   // GET 全量 ResearchRun
  → setRun(fresh)              // nodes/edges/report SSOT
  → 若当前在报告页：报告已刷新
  → 用户导航回 graph：LabGraph 读同一 run state
```

## Eden vs fixture

| 模式    | restore 后图                                            |
| ------- | ------------------------------------------------------- |
| Eden    | MUST `loadRun`；`restoreGraphSlice` 不得为 silent no-op |
| Fixture | MAY `restoreGraphSlice` + sessionStorage                |

## 非目标

- 不新增 revisions API
- 不改变 revision 快照 schema
