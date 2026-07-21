# Deep Research — UI Proto（草案骨架）

| 字段     | 值                                                      |
| -------- | ------------------------------------------------------- |
| 状态     | Draft skeleton — **待 grill-me 完善**                   |
| 依赖后端 | `c76-deep-research-runtime`（本 change FE 仅占位）      |
| 父 PRD   | [`deep-research-prd.md`](./deep-research-prd.md) v0.2.3 |

## 已锁定（产品）

E1 台 / F1 Run 大详情叠层 / G1 关详情保留 E1；深研 Tab 与直接搜索分栏。

**H1′ D1**：创建表单含「使用笔记本来源」「同时分析外网」双开关（默认皆开）+ **台内来源多选列表**（拉取 notebook sources，不读工作区勾选）；开用来源但未选时禁用开始。

**过程图（参考产品形态）**：节点状态色（结论明确 / 待完善 / 信息缺失）+ 边语义标签；终局卡「最终回答」含 **研究思路（看图）** 与 **查看报告**——入口与布局待本文件 grill。

## 本文要钉的内容（grill 主题）

1. DeepResearchDesk：配置表单（H1′ D1 双开关 + 台内来源多选 + L1）与队列卡片态
2. 「看图 / 研究思路」与「查看报告」入口：默认落在 F1 Run 详情哪一页
3. ResearchRun 详情：xyflow 节点/边语义、与 `graph_patch` 对齐
4. Citation chip ↔ popover（复用现有 CitationsControl 与否）
5. Convert 菜单信息架构
6. 待确认（M1）CTA 文案与位置

## 非目标

Runtime HTTP/tool 细节 → [`deep-research-runtime-spec.md`](./deep-research-runtime-spec.md)
