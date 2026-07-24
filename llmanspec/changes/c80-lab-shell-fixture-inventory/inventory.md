# Inventory seed: Lab UX ↔ ResearchRun API（c80 产出物草稿）

> 正式盘点在 c80 apply 走查后冻结。本文件先把**任务队列 / Compose / 入口**与既有 HTTP 对齐，供 c81/c82 依赖提案引用。
>
> **2026-07-24 细扫**（对照 `packages/shared/src/schemas/research.ts` + `listRuns`/`serializeRun`）。

## Product → API map

| 产品表面                  | Demo 现状                          | 候选 API                           | 初判                                                          |
| ------------------------- | ---------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| Compose 创建              | Lab 空态 + fixture 回放            | `POST /v2/notebooks/:nid/research` | **Keep** — 字段基本对齐，见 G4                                |
| 任务抽屉（工作区头像旁）  | `demoResearchTasks` sessionStorage | `GET /v2/notebooks/:nid/research`  | **Gap 形变** — 见 G1                                          |
| 任务抽屉（Lab 顶栏最右）  | 同上组件                           | 同上                               | 同左；无新端点                                                |
| badge 进行中计数          | 客户端滤 demo list                 | list + 客户端 / 或 `?status=`      | **Ambiguous** → 默认 defer count；见 G2/G3                    |
| 切换任务 / 恢复作业台     | 切 session + remount               | `GET …/research/:rid` + `…/stream` | **Keep**（详情全量图合理）                                    |
| 烧瓶进 Lab                | 路由捷径                           | 无 API                             | **lab-only**                                                  |
| 对话 `@` / `/` 创建或引用 | **不做（延后）**                   | —                                  | **deferred** — 闭环已由 Compose+抽屉+Lab 覆盖；另 change 再议 |

## G1–G5 细扫结论

| ID     | 项                | 代码事实                                                                                                                                 | c81 建议                                                                                                                                                    |
| ------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1** | list item 瘦摘要  | `ResearchRunsPageSchema.items` = **全量** `ResearchRunSchema`（含 `nodes`/`edges`/`report`）；`listRuns` → `serializeRun` 每条都读 graph | **fix-api**：新增 `ResearchRunSummarySchema`（id/topic/status/updatedAt/…，**无** graph/report）；list 响应用摘要；`GET :rid` 仍全量。**BREAKING** wire     |
| **G2** | `?status=`        | `ResearchListQuerySchema` = 仅 `PaginationParamsSchema`；无 status                                                                       | **可选 fix-api**：`status?: ResearchRunStatus \| ResearchRunStatus[]`；badge「进行中」= `queued\|running\|awaiting_confirm`。先不做也可客户端滤（limit 内） |
| **G3** | active-count 端点 | 无                                                                                                                                       | **defer**：G2 或客户端计数够用                                                                                                                              |
| **G4** | Compose ↔ create  | API：`topic`/`useNotebookSources?`/`sourceIds?`/`allowWeb?`/`depth?`；Compose draft 同前四字段，**未暴露 depth**（服务端有默认）         | **Keep**；depth 可 Lab 高级或 defer。gate 与 server「至少一通道」语义一致                                                                                   |
| **G5** | 抽屉取消          | `POST …/research/:rid/cancel` **已有**                                                                                                   | **Keep**；抽屉 UI 接 cancel（c82）；无需新 API                                                                                                              |
| **G6** | 对话 `@`/`/`      | 闭环已由 Compose+抽屉+Lab 覆盖                                                                                                           | **deferred** — c80–c82 不做；另 change                                                                                                                      |

### Create 默认与门禁（对照备注）

- shared create 字段可选布尔；服务端 H1′ defaults 在 create handler（inventory 走查时核对默认是否与 Compose demo「外网优先」一致）。
- Compose `resolveLabComposeBlockReason`：topic / 无通道 / 开笔记本却无 source — 与产品门禁一致即可，不必新错误码。

## 对话 `@` / `/`（**deferred**）

产品闭环已成立，**不进 c80–c82**。历史备忘：勿把深研挂进 `GET /v2/commands`（那是 prompt 预设）；若将来做嵌入，另开 change，复用 ChatPanel token UX 而非 commands API。

## Already exists（作业台；不全列）

create / get / stream / cancel / confirm / prune / fork / node PATCH / node chat / progress / revisions / report·working / convert — 详见 research router；c80 走查后填 Keep/Gap/Extra。

## Extra（fixture-only，勿升格为 API）

- scenario 切换控制台、xlsx-lib timer 回放、`demoResearchTasks` park session
