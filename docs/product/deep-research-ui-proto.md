# Deep Research — UI Proto（草案骨架）

| 字段     | 值                                                      |
| -------- | ------------------------------------------------------- |
| 状态     | Draft skeleton — **待 grill-me 完善**                   |
| 依赖后端 | `c76-deep-research-runtime`（本 change FE 仅占位）      |
| 父 PRD   | [`deep-research-prd.md`](./deep-research-prd.md) v0.2.3 |

## 已锁定（产品）

E1 台 / F1 Run 大详情叠层 / G1 关详情保留 E1；深研 Tab 与直接搜索分栏。

**H1′ D1**：创建表单含「使用笔记本来源」「同时分析外网」双开关（默认皆开）+ **台内来源多选列表**（拉取 notebook sources，不读工作区勾选）；开用来源但未选时禁用开始。

**过程图（参考产品形态 + 交互）**：xyflow DAG 即「研究思路」本身——**可交互、可剪枝、可 fork 支路**；节点状态色（结论明确 / 待完善 / 信息缺失）+ 边语义。终局阅读以**研究报告**为主，**不**再单独提供与图并列的「研究思路」阅读页（思路已在图上）。

## 本文要钉的内容（grill 主题）

1. DeepResearchDesk：配置表单（H1′ D1 双开关 + 台内来源多选 + L1）与队列卡片态
2. Run 详情：默认/主表面 = **可交互图**；报告为终局阅读面（无并列「研究思路」页）
3. 剪枝 / fork 的触发时机与 API 对齐（见 runtime-spec）
4. Citation chip ↔ popover（复用现有 CitationsControl 与否）
5. Convert 菜单信息架构
6. 待确认（M1）CTA 文案与位置

## 非目标

Runtime HTTP/tool 细节 → [`deep-research-runtime-spec.md`](./deep-research-runtime-spec.md)
