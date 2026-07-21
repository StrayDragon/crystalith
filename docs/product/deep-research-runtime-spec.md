# Deep Research — Runtime Spec（草案骨架）

| 字段        | 值                                                      |
| ----------- | ------------------------------------------------------- |
| 状态        | Draft skeleton — **待 grill-me 完善**                   |
| 对应 change | `c76-deep-research-runtime`                             |
| 父 PRD      | [`deep-research-prd.md`](./deep-research-prd.md) v0.2.3 |

## 已锁定（勿在 grill 中推翻，除非显式改 PRD）

B / B1 / H1 / I1 / K1 / L1 / M1 及顶栏 E1/F1/G1（见父 PRD §0）。

## 本文要钉的内容（grill 主题）

1. HTTP 路径与 Zod 字段级细节（create body、Run 状态枚举、stream 事件）
2. Tool 输入/输出与 checkpoint 粒度
3. Report JSON 形状（sections / inline citeId）与脚注 serializer
4. convertToNote / convertToSource 请求体（artifactRef）
5. 错误码与取消语义

## 非目标

FE/xyflow 交互 → [`deep-research-ui-proto.md`](./deep-research-ui-proto.md)
