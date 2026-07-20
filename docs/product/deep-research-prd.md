# Crystalith Deep Research — 决策索引

| 字段      | 值                                                                                |
| --------- | --------------------------------------------------------------------------------- |
| 文档状态  | v0.3 — **仅保留 Grill §0**；长文已弃用                                            |
| 日期      | 2026-07-21                                                                        |
| 后端 SSOT | llman change **`c76-deep-research-runtime`**（`design.md` Runtime wire + delta）  |
| FE 决策   | [`deep-research-ui-proto.md`](./deep-research-ui-proto.md)（另开 FE change 实现） |
| 下一步    | `llman-sdd-apply` → c76                                                           |

---

## 0. 已固定决策（Grill 摘要）

| ID         | 决策                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| **B**      | **`ResearchRun` 为过程 SSOT**（图 / checkpoint / report 挂在 run）；不把长跑状态塞进 Output 行当唯一权威 |
| **B1**     | **不自动落笔记**：Run 内始终有权威报告；进「笔记 / 来源」列表靠用户**显式转化**                          |
| **IA-1**   | **前置改造：搜索迁到中间顶栏**（来源栏回归「库管理」）— **c75 已落地**                                   |
| **IA-2**   | **深研主入口 = 顶栏输入 → 二级页**（任务 / 队列 / 操作 / 活卡片）                                        |
| **IA-3**   | 三栏：**来源 = 入库**；**笔记 = 合成文档**；**对话 = RAG**；深研是跨栏生产线                             |
| **E1**     | 顶栏二级页 = 顶栏锚定宽幅面板；「直接搜索 \| 深度研究」                                                  |
| **F1**     | E1 = 队列/新建台；点 Run → 更大 Layer 详情（xyflow + 报告）                                              |
| **G1**     | 打开 Run 详情时 E1 **保持挂载**；关详情后 Tab/query/队列原样                                             |
| **H1**     | 创建：显式 `useNotebookSources` + `allowWeb`（默认皆开）；**台内**重选来源；空选禁用开始                 |
| **I1**     | `convertToNote` / 笔记落库 **仅 Markdown `PARAGRAPH`**                                                   |
| **K1**     | 报告 SSOT = 结构化 cite + 全局 citation map；转笔记 → GFM `[^n]`；首版不做 MD 双向解析                   |
| **L1**     | 深度：浅 8/12；中 20/30；深 40/60；默认中                                                                |
| **M1**     | 待确认仅：预算将尽 / 扩支路；无逐步审批、无转化弹窗                                                      |
| **U1**     | 过程图 = 可交互思路；终局以报告为主；无并列「研究思路」页                                                |
| **U2**     | 剪枝/fork：`running`/`awaiting_confirm`；完成后只读；改方向开新 Run                                      |
| **R4**     | 节点结论：`clear`/`partial`/`missing`/`pending`/`pruned`                                                 |
| **C1**     | 图色：工作区语义色；`pruned` 降透明度                                                                    |
| **R5**     | 边闭集：`decompose`/`expand`/`focus`/`filter`/`compare`/`refine`/`support`/`fork`/`merge`                |
| **R6**     | 报告：`sections[].blocks` + 全局 `citations`                                                             |
| **R7**     | convert：`report` \| `node` \| `evidence`                                                                |
| **A1**     | 协作 cancel + checkpoint → `cancelled`                                                                   |
| **CP1**    | Checkpoint：每节点完成 + 进 M1 前                                                                        |
| **UI-C1**  | 复用 CitationsControl                                                                                    |
| **D1**     | SSE `graph_patch` 增量 upsert/remove                                                                     |
| **E1′**    | 节点可转笔记/来源；入口淡化                                                                              |
| **F1-CTA** | M1 = 图高亮 + 详情顶栏确认条                                                                             |
| **ERR-G1** | `AppHttpError` + 仅增 `RESEARCH_INVALID_STATE`、`RESEARCH_BUDGET`                                        |
| **EV1**    | Run 作用域证据表                                                                                         |

> ID：布局 **G1** ≠ **ERR-G1**；创建 **H1** ≠ 证据 **EV1**；笔记 **I1** ≠「收口后 apply」。

---

## 权威落点

| 内容                                | 位置                                                      |
| ----------------------------------- | --------------------------------------------------------- |
| 后端 HTTP / Zod / SSE / 状态机 MUST | `llmanspec/changes/c76-deep-research-runtime/`            |
| FE 壳与交互清单                     | `docs/product/deep-research-ui-proto.md` → 未来 FE change |
| 顶栏直接搜索                        | 已归档 `c75-workspace-topbar-search`                      |
