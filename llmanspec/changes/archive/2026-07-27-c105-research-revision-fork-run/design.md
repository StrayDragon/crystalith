# Design: c105 revision → fork new ResearchRun

## 1. 目标

| 做                                                | 不做                            |
| ------------------------------------------------- | ------------------------------- |
| `POST …/revisions/:revId/fork-run` 创建**新** Run | 污染原 Run（图/报告/revisions） |
| 拷贝 revision 快照的 graph + report + 配置        | C3 并行；改同 Run restore 语义  |
| 拷贝证据行并 remap id（保证 cite/抽屉可用）       | 自动二次 decompose / 静默改图   |
| Lab 报告页「基于此快照新开研究」→ `?rid=`         | Demo fixture 权威               |

## 2. 命令口

```text
POST /v2/notebooks/:nid/research/:rid/revisions/:revId/fork-run
  body: { schedule?: boolean }   // 默认 false
  → 201 ResearchRun（新 id）
```

### 拷贝字段

- 自 **revision 快照**：`graph`、`report`（可 null）
- 自 **源 Run**：`topic`、`useNotebookSources`、`allowWeb`、`sourceIds`、`depth`、`maxSearches`、`maxNodes`、`modelId`
- **重置**：`searchesUsed=0`、`status=queued`、`confirmKind=null`、`checkpoint=null`、`cancelRequested=false`、`activeRevisionId=null`、无 working CoW
- **证据**：复制源 Run 上被快照 graph `evidenceIds`（及 report citation keys）引用到的 evidence 行到新 `runId`；**新 evidence id** + 图/报告内 remap（PK 全局唯一）
- **progress / revisions**：新 Run 空账本；不复制旧 revisions 列表

### schedule

- 默认 **不** `scheduleRun`（避免一 fork 就重跑 drain）
- `schedule: true` → `scheduleRun`；既有 live research 支路走 r327 drain（预算已重置）
- Lab 入口默认 `schedule: false`；用户到图作业台后再用既有「开始/继续」面触发续跑时可后续补 resume 口（本变更可不新增，若 Lab queued+有图无控件则最小加 `POST …/schedule` 或 fork 后 `schedule:true` 由产品按钮选择——**锁定 apply：报告页 fork 传 `schedule:false`；若 Lab 对 queued 且已有 graph 无入口，则补最小 `POST …/research/:rid/schedule` 仅允许 queued→running**)

## 3. 原 Run

- MUST 只读：fork 后源 Run 的 graph/report/revisions/status 不变
- fork MUST NOT 调用 restore

## 4. Lab UI

- `EdenLabReportPage` revisions 区：选中 revision 后「基于此快照新开研究」
- testid：`research-lab-revision-fork-run`（或等价）
- 成功 → `navigate` 产品 Lab `/research-lab/:nid?rid=<newId>`
- Demo 报告页可不实现（或 stub）；产品 Eden ONLY

## 5. 红线

1. 命令口突变；无客户端整图上传
2. 原 Run 不变
3. BDD-off；独立 `sdd/c105-…` 分支

## 6. 测试

- integration：fork → 新 id；源不变；graph/report 对齐 revision；evidence remap 可读
- `schedule:false` 保持 queued；`schedule:true` 进入 running/awaiting_confirm/completed
- Vitest：报告页按钮调用 fork API 并导航
