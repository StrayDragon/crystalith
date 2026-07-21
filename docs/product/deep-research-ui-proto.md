# Deep Research — UI Proto（草案骨架）

| 字段     | 值                                                      |
| -------- | ------------------------------------------------------- |
| 状态     | Draft skeleton — **待 grill-me 完善**                   |
| 依赖后端 | `c76-deep-research-runtime`（本 change FE 仅占位）      |
| 父 PRD   | [`deep-research-prd.md`](./deep-research-prd.md) v0.2.3 |

## 已锁定（产品）

E1 台 / F1 Run 大详情叠层 / G1 关详情保留 E1；深研 Tab 与直接搜索分栏。

## 本文要钉的内容（grill 主题）

1. DeepResearchDesk：配置表单（H1/L1）与队列卡片态
2. ResearchRun 详情 Layer：xyflow 节点/边语义、报告入口
3. Citation chip ↔ popover（复用现有 CitationsControl 与否）
4. Convert 菜单信息架构
5. 待确认（M1）CTA 文案与位置

## 非目标

Runtime HTTP/tool 细节 → [`deep-research-runtime-spec.md`](./deep-research-runtime-spec.md)
