# Design: c80 Lab shell + xlsx-lib fixture + inventory

## Goals

- Lab = 深研作业台；`xlsx-lib` 写死跑通设计面。
- 产出可执行的 **inventory**，驱动 c81（含任务列表 / Compose）。

## Product surfaces（闭环已成立；对话嵌入延后）

```text
创建 ── Compose（Lab 空态；烧瓶 / 抽屉「新建」）──► POST create（c82）
进行中/历史 ── 任务抽屉（头像旁 + Lab 顶栏最右）──► GET list（c82）
作业台 ── Lab 图/报告 ──► stream + run detail（c82）

延后（不进 c80–c82 范围）：
  对话 @ / / 创建或引用 ResearchRun
```

## Lab surfaces checklist（盘点必覆盖）

| 表面                                       | Lab/Demo 现状    | inventory 列               |
| ------------------------------------------ | ---------------- | -------------------------- |
| Compose 空态                               | 有（demo）       | ↔ POST create 字段         |
| 任务抽屉 + badge（头像旁 **与 Lab 最右**） | 有（demo store） | ↔ GET list / status 过滤   |
| 路由 / 烧瓶捷径                            | 有               | Keep 为进 Lab 入口         |
| 图 + chrome                                | 有               | 是否需 API                 |
| prune/fork 对话框                          | 有               | ↔ POST prune/fork          |
| 节点抽屉 + chat 提案                       | 有               | ↔ node chat SSE + 命令口   |
| M1/确认类                                  | Lab 机制         | ↔ confirm                  |
| 报告 Plate + cite aside                    | 有               | ↔ report/working/revisions |
| revisions / CoW                            | sessionStorage   | ↔ revisions API            |
| progress（顶栏 flex 占满剩余）/ console    | 有               | ↔ progress events          |
| export / suggested report                  | 有               | 是否需 API                 |
| scenario 切换                              | 控制台高级       | c80 锁定 xlsx-lib          |
| 对话 `@`/`/`                               | **不做**         | inventory：**deferred**    |

## API 预清点（写入 inventory.md 时展开）

### Already exists（优先 Keep / 形变检查）

| 能力         | HTTP                                      | 任务队列用法      |
| ------------ | ----------------------------------------- | ----------------- |
| 创建 Run     | `POST /v2/notebooks/:nid/research`        | Compose 提交      |
| 列表 Runs    | `GET /v2/notebooks/:nid/research`         | 任务抽屉数据源    |
| Run 详情     | `GET …/research/:rid`                     | 切换任务 / 恢复   |
| 流式图/状态  | `GET …/research/:rid/stream`              | Lab 权威态（c82） |
| prune/fork/… | 既有 nodes / confirm / revisions / report | 作业台            |

### Possible Gap（c81 决策）

| 缺口               | 建议默认                              |
| ------------------ | ------------------------------------- |
| list `status` 过滤 | 可选；否则客户端滤                    |
| 轻量 active-count  | **defer**                             |
| Run summary DTO    | **fix-api**（list 过重）              |
| cancel 从抽屉      | Keep 既有 cancel；c82 接线            |
| 对话 `@`/`/`       | **deferred**（另 change；非 c80–c82） |

## Port sketch

```
LabSessionPort
  loadFixture(xlsx-lib) |     // c80 only authority
  listDemoTasks / switchTask  // demo；c82 → listRuns + getRun
  applyLocalMutation…         // prune/fork/chat accept — local until c82
```

c82 换 `EdenResearchSessionPort`，UI 不换权威语义（Compose / 任务抽屉 / 图）。

## Inventory 输出

`inventory.md`：Keep / Gap / Extra / Ambiguous；**必含** Compose、任务抽屉、badge；对话入口标 deferred。

## Non-Goals

- 真 LLM、真 ResearchRun 写入
- 删 research API
- 对话 `@` / `/` 嵌入创建或引用
