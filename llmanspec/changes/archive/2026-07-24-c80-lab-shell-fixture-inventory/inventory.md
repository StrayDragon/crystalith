# Inventory: Lab UX ↔ ResearchRun API（c80）

> 走查基准：Compose → `xlsx-lib` 回放 → 图 / 节点 / 报告 / revisions / progress；任务抽屉双入口。
> **会话权威**：fixture（`fixtureLabSessionPort`）；**MUST NOT** 本变更接 Eden（c82）。

## Keep

| Lab 动作 / 表面      | HTTP / SSE                         | 备注                                                                                           |
| -------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| Compose 提交字段     | `POST /v2/notebooks/:nid/research` | topic / useNotebookSources / sourceIds / allowWeb / depth?；Compose 未暴露 depth（服务端默认） |
| 任务抽屉列表 / badge | `GET …/research`                   | 分页存在；见 Gap G1 瘦摘要                                                                     |
| 切换 / 恢复作业台    | `GET …/:rid` + `GET …/stream`      | 详情全量图合理                                                                                 |
| 取消 Run             | `POST …/:rid/cancel`               | 抽屉 UI 接线留 c82                                                                             |
| prune / fork         | `POST …/nodes/:id/prune\|fork`     | Lab 对话框已演练                                                                               |
| 节点 PATCH           | `PATCH …/nodes/:id`                |                                                                                                |
| 节点 chat 提案       | `…/nodes/:id/chat` SSE             | 形变核对留给 c81                                                                               |
| confirm              | `POST …/confirm`                   |                                                                                                |
| progress             | `GET …/progress`                   | 顶栏 progress 条 demo 为 phase 映射                                                            |
| revisions / restore  | revisions CRUD                     | Lab sessionStorage CoW                                                                         |
| report / working     | report endpoints                   | Plate + cite aside                                                                             |
| convert note/source  | convert endpoints                  |                                                                                                |
| 烧瓶进 Lab           | —                                  | lab-only 路由捷径                                                                              |

## Gap（c81 优先）

| ID  | 项                                                   | 建议                                                  |
| --- | ---------------------------------------------------- | ----------------------------------------------------- |
| G1  | list 项为全量 `ResearchRun`（含 nodes/edges/report） | **fix-api** → `ResearchRunSummary`；`GET :rid` 仍全量 |
| G2  | 无 `?status=`                                        | 可选 fix-api；否则客户端滤                            |
| G3  | 无 active-count                                      | **defer**（list 计数）                                |
| G4  | create 默认 vs Compose「外网优先」                   | 走查核对 H1′ defaults；形变则文档或 fix               |
| G5  | 抽屉取消 UI                                          | Keep API；c82 接线                                    |

## Extra（fixture-only；勿升格 API）

| 项                                 | 说明                             |
| ---------------------------------- | -------------------------------- |
| `xlsx-lib` timer 回放              | 主路径 fixture                   |
| 试验控制台 scenario 切换           | 高级 only；产品路径锁定 xlsx-lib |
| `demoResearchTasks` / park session | c82 → listRuns + getRun          |
| `fixtureLabSessionPort`            | c82 → Eden port                  |
| export 建议报告（本地图）          | 可选真 API 另议                  |

## Ambiguous / deferred

| 项                        | 决                                                        |
| ------------------------- | --------------------------------------------------------- |
| 对话 `@` / `/` 创建或引用 | **deferred**（闭环已由 Compose+抽屉+Lab 覆盖；另 change） |
| badge 专用 count 端点     | defer（G3）                                               |
| list status 过滤          | Ambiguous → 默认客户端或可选 G2                           |

## c81 必改 vs 文档 vs deferred

| 类别                 | 项                                          |
| -------------------- | ------------------------------------------- |
| **c81 必改（建议）** | G1 Summary schema + list handler + tests    |
| **c81 可选**         | G2 `?status=`                               |
| **仅文档**           | G4 默认核对、Keep 表、Extra 标注            |
| **deferred**         | G3 count；G6 对话 `@`/`/`；Eden 接线（c82） |

## 走查清单（t4 / r421）

| 表面                      | 状态            |
| ------------------------- | --------------- |
| Compose → 回放            | demo 已实现     |
| 图 chrome / prune / fork  | Lab 既有        |
| 节点抽屉 + chat 提案      | Lab 既有        |
| 报告 Plate + cite         | Lab 既有        |
| revisions                 | sessionStorage  |
| progress 顶栏 flex        | 已占满剩余宽度  |
| 任务抽屉头像旁 + Lab 最右 | demo 已实现     |
| badge 进行中              | demo store 计数 |
