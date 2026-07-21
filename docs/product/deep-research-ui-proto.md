# Deep Research — UI Proto（决策已锁 · FE 另 change）

| 字段      | 值                                                               |
| --------- | ---------------------------------------------------------------- |
| 状态      | **Decisions locked** — 实现另开 FE change；c76 仅后端 + FE 占位  |
| 依赖后端  | `c76-deep-research-runtime`                                      |
| 父 PRD    | [`deep-research-prd.md`](./deep-research-prd.md) v0.3（§0 索引） |
| 后端 SSOT | `llmanspec/changes/c76-deep-research-runtime/design.md`          |

## 已锁定（勿再 grill 推翻，除非改 PRD）

| ID           | 决策                                                            |
| ------------ | --------------------------------------------------------------- |
| E1 / F1 / G1 | 顶栏台 + Run 大详情叠层；关详情保留 E1                          |
| H1′          | 双开关 + 台内来源多选；空选禁用开始                             |
| L1 / M1      | 三档深度；确认仅预算 / 扩支路                                   |
| U1 / U2      | 图=可交互思路；running/awaiting_confirm 可剪枝 fork；完成后只读 |
| R4 / C1      | 结论态五态；工作区语义色（非参考图绿紫红）                      |
| UI-C1        | 复用 CitationsControl                                           |
| E1′          | 节点可转笔记/来源，入口淡化                                     |
| F1-CTA       | M1 = 图高亮 + 详情顶栏确认条                                    |

## 实现清单（FE change，非 c76）

1. DeepResearchDesk（H1′ + L1 + 队列卡片）
2. Run 详情 Layer：主表面 xyflow；报告终局面
3. prune / fork 控件（对齐 runtime U2）
4. Citation chips（UI-C1）
5. Convert 菜单（E1′）
6. M1 确认条（F1-CTA）

## 非目标

Runtime HTTP / Zod / SSE → **`c76-deep-research-runtime/design.md`**（Runtime wire）
