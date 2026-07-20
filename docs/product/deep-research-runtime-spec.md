# Deep Research — Runtime Spec（草案）

| 字段        | 值                                                      |
| ----------- | ------------------------------------------------------- |
| 状态        | Draft — grill 进行中（R1′ D1、R2a、R3b 已定）           |
| 对应 change | `c76-deep-research-runtime`                             |
| 父 PRD      | [`deep-research-prd.md`](./deep-research-prd.md) v0.2.3 |

## 已锁定（勿在 grill 中推翻，除非显式改 PRD）

B / B1 / **H1′（D1）** / I1 / K1 / L1 / M1 及顶栏 E1/F1/G1（见父 PRD §0）。

## 1. Create body（R1′ D1）

```ts
{
  topic: string; // 必填
  useNotebookSources?: boolean; // 默认 true — 是否使用笔记本内来源
  sourceIds?: number[]; // 仅深研台选择器；与 workspace 勾选无关
  allowWeb?: boolean; // 默认 true — 是否同时走外网路径
  depth?: 'shallow' | 'medium' | 'deep'; // 默认 'medium' → L1
}
```

**校验**

- `useNotebookSources || allowWeb` 至少其一为 true，否则 400。
- `useNotebookSources === true` 且 `sourceIds` 为空/缺省 → 400（UI 应禁用开始并提示勾选）。
- `useNotebookSources === false` 时忽略 `sourceIds`（或必须为空）。

## 2. Run status（R2a）

| status             | 含义              |
| ------------------ | ----------------- |
| `queued`           | 已创建、尚未开跑  |
| `running`          | 执行中            |
| `awaiting_confirm` | M1 硬停待用户确认 |
| `completed`        | 有终稿            |
| `failed`           | 不可恢复失败      |
| `cancelled`        | 用户取消          |

## 3. Stream events（R3b）

GET `…/research/:rid/stream`（SSE，对齐 c70）。事件：

| event          | 用途                                              |
| -------------- | ------------------------------------------------- |
| `status`       | `{ status, reason? }`                             |
| `graph_patch`  | 节点/边增改（增量）；须足以驱动图中状态色与边标签 |
| `confirm`      | M1 payload（预算将尽 / 扩支路 + 选项）            |
| `report_ready` | 终稿可取（亦可仅靠 `status=completed`）           |
| `log`          | 人类可读进度行（时间线/调试）                     |
| `error`        | 错误信息                                          |

**不做**：报告正文逐 token 流式（合成后挂 Run，再 `report_ready` / 拉取）。

**产品形态补充（相对纯 API）**：活 Run 还须提供「看图 / 研究思路」入口（xyflow 过程图）与「查看报告」入口——见 ui-proto；stream 的 `graph_patch` 为图的数据面。

## 待钉（grill 主题）

1. 图节点状态枚举（对齐参考图：结论明确 / 待完善 / 信息缺失）与边标签集合
2. 「看图」入口放哪（E1 卡片 vs F1 详情默认页）
3. Report JSON 形状与脚注 serializer
4. convertToNote / convertToSource 请求体（artifactRef）
5. 错误码与取消语义

## 非目标

FE/xyflow 交互 → [`deep-research-ui-proto.md`](./deep-research-ui-proto.md)
