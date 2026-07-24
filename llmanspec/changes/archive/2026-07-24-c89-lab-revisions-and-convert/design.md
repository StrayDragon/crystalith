# Design: c89 Lab revisions + convert

## Scope

在 c85 Eden 报告页基础上，接线 **服务端 revisions**、**report CoW（working/canonical）** 与 **convert-to-note/source**。实现 live r419 在 Lab 报告面的落地；无新 API（c78 已有）。

## Revisions 流

```
LabReportPage（eden）
    → GET …/revisions → 列表
    → POST …/revisions { label, from } → 创建快照
    → GET …/revisions/:revId → 查看
    → POST …/revisions/:revId/restore → 写回 graph+report
        → graph_patch / GET run 刷新
```

|MUST NOT| sessionStorage `labRevisions` 作为 Eden 列表 SSOT |

## Report CoW

| 操作           | API                                              |
| -------------- | ------------------------------------------------ |
| 读权威         | `GET run.report` 或 `GET …/report`               |
| 读 working     | `GET …/report/working`                           |
| 写 working     | `PUT …/report/working`                           |
| 提交 canonical | `PUT …/report`                                   |
| 丢弃 working   | `DELETE …/report/working`（或既有 discard 端点） |

UI 复用 `LabReportPlateEditor` 编辑态；持久化走 Eden 而非 `reportCow.ts` localStorage。

## Convert 流

```
用户点「转为笔记」/「转为来源」
    → POST …/convert-to-note | convert-to-source
        body: { artifact: { kind: 'report' | 'node' | 'evidence', … } }
    → toast 成功/失败（r409）
    → MAY 链接到新建 note/source
```

入口：

- 报告页：整份 report
- 节点抽屉：kind=node（nodeId）或 kind=evidence（evidenceId，依赖 c87 映射）

## Mode 分支

| 能力           | Eden            | Fixture                    |
| -------------- | --------------- | -------------------------- |
| Revisions 列表 | GET/POST server | `labRevisions`             |
| Working copy   | server working  | `reportCow` sessionStorage |
| Convert        | HTTP convert-*  | MAY stub toast「演示」     |

## Seams

| 模块                | 职责                                                      |
| ------------------- | --------------------------------------------------------- |
| `edenResearchApi`   | list/create/get/restore revision；report working；convert |
| `LabReportPage`     | eden revisions UI + CoW + convert                         |
| `LabNodeDrawer`     | convert 入口（淡化）                                      |
| `fake/labRevisions` | fixture-only                                              |

## 与邻接 change 边界

- **c85**：只读 report 加载；本变更扩展同一页面
- **c87**：evidenceId 供 convert artifact
- **c88**：chat 不含 convert

## Guardrails

- MUST NOT sessionStorage 作为 Eden revisions SSOT（r419）
- MUST NOT 强制转化确认对话框（r409）
- MUST NOT 平行 convert DTO

## Testing

- Vitest：eden revisions loader mock API；convert toast
- Server：revisions/convert 回归（c78 已有）
- 手测：创建 revision → 恢复 → 图/报告变化；convert → 工作区可见 note/source
