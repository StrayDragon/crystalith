---
depends_on: [c89-lab-revisions-and-convert]
---

## Why

c89 落地 Eden 报告修订（`POST …/revisions/:revId/restore`）；恢复后报告页可反映快照，但用户返回图作业台时画布仍可能显示**恢复前**的图——因 Eden 路径 `restoreGraphSlice` 为 fixture 专用 no-op，或未在导航回 graph 时 `GET …/research/:rid` 重载。本变更保证 revision restore 后图与报告一致，落实 r441 残余。

## What Changes

1. **恢复后 GET**：Eden `restore` 成功 MUST 触发 `getResearchRun`（或 graph_patch 全量）刷新本地 `run.nodes/edges`。
2. **返回图视图**：从报告页返回 `/research-lab/:nid?rid=` 图作业台时 MUST 应用已刷新 Run 图，画布与 restored snapshot 一致。
3. **禁止静默 no-op**：Eden 路径 MUST NOT 将 `restoreGraphSlice` 留作空操作而仅更新报告正文。
4. **Fixture 隔离**：fixture 模式 MAY 继续 `restoreGraphSlice` + sessionStorage。
5. **质量**：Vitest：restore 后 `loadRun` 调用与 nodes 更新；手测 restore → 报告 → 返回图。

## Locked decisions

- **BDD-off**；Apply：**全程 main**（本 change archive+commit 后才开下一条）
- Fixture 保留至 c100；产品默认 Eden
- M1 / 相位在 c96/c97；本变更仅 revision↔graph 同步
- **本波 MUST NOT 再延后**

## Capabilities

- `deep-research-ui` — 修订恢复与图同步

## Impact

- depends_on c89（Eden revisions API + LabReportPage）
- 无服务端变更；客户端 reload 纪律
- 与 c97 可并行

## Seams

- `LabReportPage` — restore 成功回调
- `useEdenLabController.loadRun` / `setRun` — 图 SSOT 刷新
- `restoreGraphSlice` — eden vs fixture 分支
- 报告页 → 图页导航（`?rid=` 保持）
