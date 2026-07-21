# Deep Research — UI Proto（草案骨架）

| 字段     | 值                                                      |
| -------- | ------------------------------------------------------- |
| 状态     | Draft skeleton — **待 grill-me 完善**                   |
| 依赖后端 | `c76-deep-research-runtime`（本 change FE 仅占位）      |
| 父 PRD   | [`deep-research-prd.md`](./deep-research-prd.md) v0.2.3 |

## 已锁定（产品）

E1 台 / F1 Run 大详情叠层 / G1 关详情保留 E1；深研 Tab 与直接搜索分栏。

**H1′ D1**：创建表单含「使用笔记本来源」「同时分析外网」双开关（默认皆开）+ **台内来源多选列表**（拉取 notebook sources，不读工作区勾选）；开用来源但未选时禁用开始。

**过程图**：xyflow DAG = 可交互思路（U1/U2）；节点结论态 R4a。配色 **C1**：复用工作区语义色（成功/警告/危险/中性），`pruned` 降透明度。

## 本文要钉的内容（grill 主题）

1. DeepResearchDesk：配置表单（H1′ D1 双开关 + 台内来源多选 + L1）与队列卡片态
2. Run 详情：默认/主表面 = **可交互图**；报告为终局阅读面（无并列「研究思路」页）
3. 剪枝 / fork：**U2a** — `running`/`awaiting_confirm` 可操作；完成后只读；改方向 → 新 Run
4. Citation chip ↔ popover：**C1** — 复用现有 `CitationsControl` + 跳转来源
5. Convert 菜单信息架构
6. 待确认（M1）CTA 文案与位置

## 非目标

Runtime HTTP/tool 细节 → [`deep-research-runtime-spec.md`](./deep-research-runtime-spec.md)
