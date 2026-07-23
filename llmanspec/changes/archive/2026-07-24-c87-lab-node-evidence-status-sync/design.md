# Design: c87 Lab node evidence + status sync

## Scope

在 c82 Eden 接线基础上，补齐 **节点抽屉 evidence 展示**、**节点/图终态文案** 与 **进度/playing 推导** 与 `ResearchRun` 一致。可能含最小 server/shared 补 `evidences[]` on GET run（若当前 wire 不足以渲染）；主 delta 在 `deep-research-ui`。

## Evidence 映射

```
GET run
    → nodes[].evidenceIds
    → evidences[]（Run 级，或从 report.citations 反查）
        → evidenceToLabCitation(ev) → Record<id, LabCitation>
    → LabNodeDrawer citations={edenCitations}
        → node.citationIds.map(id => citations[id])
```

| 条件                                | 抽屉引用区                                       |
| ----------------------------------- | ------------------------------------------------ |
| `evidenceIds.length > 0` 且映射命中 | 列表展示 title + snippet                         |
| ids 存在但映射缺失                  | 展示 id +「加载中/未知证据」降级，非「暂无引用」 |
| ids 为空                            | MAY 显示「暂无引用」                             |

Eden 路径 MUST NOT 传入 `lab.scenario.citations`。

## 节点终态

| Run status             | 结论节点标签                   | research 节点           |
| ---------------------- | ------------------------------ | ----------------------- |
| `completed`            | 完成 / 综述就绪（非「排队…」） | 反映 `conclusionStatus` |
| `failed` / `cancelled` | 失败/已取消                    | 只读弱化                |
| `running` / `queued`   | 由 `node.phase` 或服务端字段   | 进行中语义              |

`researchGraphAdapter.researchNodeToLabNode` MAY 在终态 Run 覆盖 `phase` 展示字段；`LabGraph` statusOverride 对齐 r414。

## Refresh 触发

```
SSE graph_patch → merge nodes/edges（已有）
SSE status → completed | failed | cancelled
    → getResearchRun(full)  // 对齐 phase、evidenceIds、report
SSE report_ready → getResearchRun（c82 已有，确保节点字段同步）
```

## playing / 横幅

| Run status             | `playing` | 顶栏暂停横幅                         |
| ---------------------- | --------- | ------------------------------------ |
| `queued` / `running`   | true      | 不展示「已暂停」                     |
| `awaiting_confirm`     | false     | 「等待确认…」，非「多源探索 + 暂停」 |
| `completed` / terminal | false     | 隐藏                                 |

`useEdenLabController.playing` 保持 `queued|running`；`ResearchLabPage` 横幅条件排除 `awaiting_confirm` 的误判。

## Seams

| 模块                     | 职责                                              |
| ------------------------ | ------------------------------------------------- |
| `evidenceAdapter`        | `ResearchEvidence` / citations → `LabCitation`    |
| `useEdenLabController`   | 终态 GET refresh；导出 `citations` 或 `evidences` |
| `ResearchLabPage`        | eden 传 drawer citations；修正横幅条件            |
| `researchGraphAdapter`   | 终态 phase 展示                                   |
| `LabGraph` / `labLayout` | 节点 status 标签                                  |

## 与邻接 change 边界

- **c85**：报告页 citations；本变更聚焦节点抽屉与图节点标签
- **c88**：chat 不改 evidence 列表来源
- **c89**：convert 入口不在本变更

## Guardrails

- MUST NOT 第二套 evidence DTO（shared SSOT，r423）
- MUST NOT 在 Eden 默认路径使用 scenario citations
- fixture 模式 MAY 保持 `scenario.citations`

## Testing

- Vitest：`evidenceToLabCitation`；drawer 非空 given evidenceIds
- Vitest：`awaiting_confirm` 不触发 playing 横幅矛盾
- 手测：completed Run → 打开研究节点 → 引用列表非空
