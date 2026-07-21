# Deep Research — Runtime Spec（草案）

| 字段        | 值                                                      |
| ----------- | ------------------------------------------------------- |
| 状态        | Draft — grill 进行中（R1′–R6a 等已定）                  |
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

**产品形态补充**：图即思路（可剪枝 / fork）；终局以报告为主，无并列「研究思路」文档页。`graph_patch` + 后续 prune/fork API 为数据面。

## 4. Graph interaction（U2a）

| 动作  | 时机                                   | 语义                                                                                              |
| ----- | -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| prune | `running` \| `awaiting_confirm`        | 废弃子树，后续不再扩展；证据是否仍可被报告引用 = 实现默认「可引用已产出证据，跳过废弃支路新检索」 |
| fork  | 同上                                   | 从节点开新支路（可选 user hint）；与 M1「扩支路」同一能力面                                       |
| 只读  | `completed` \| `failed` \| `cancelled` | 可浏览图；改方向 → 新 Run（P2：从节点 fork 新 Run）                                               |

API 占位：`POST …/research/:rid/nodes/:nodeId/prune`、`…/fork`（body 可含 `hint`）。

## 5. Node conclusion status（R4a）

语义（与参考图**同构、异色**——配色走 Crystalith token / 深研专用色板，**不**复刻参考图绿紫红）：

| status    | 含义          |
| --------- | ------------- |
| `clear`   | 结论明确      |
| `partial` | 结论待完善    |
| `missing` | 信息缺失      |
| `pending` | 尚未检索/生成 |
| `pruned`  | 已剪枝        |

执行中过程用节点 `phase`（如 `retrieving` / `synthesizing`），与结论态分离。

## 6. Edge kinds（R5a）

闭集（主控/用户 fork 只能选这些）；UI 用 i18n 显示。可选 `labelNote?: string` 短备注。

`decompose` | `expand` | `focus` | `filter` | `compare` | `refine` | `support` | `fork` | `merge`

## 7. Report shape（R6a + K1）

```ts
{
  title: string;
  sections: Array<{
    id: string;
    heading: string;
    blocks: Array<
      | { type: 'paragraph'; text: string; citeIds: string[] }
      | { type: 'bullets'; items: Array<{ text: string; citeIds: string[] }> }
    >;
  }>;
  citations: Record<string, Citation>; // 全局 map；Citation 复用 shared schema
}
```

- 交互预览：chip 绑定 `citeIds` → `citations[citeId]`。
- `convertToNote`：按出现序编号 → GFM `[^n]` + 脚注附录。

## 8. Convert artifactRef（R7a）

```ts
type ArtifactRef =
  { kind: 'report' } | { kind: 'node'; nodeId: string } | { kind: 'evidence'; evidenceId: string };

// POST …/convert-to-note | …/convert-to-source
{
  artifact: ArtifactRef;
}
```

- Note：始终 PARAGRAPH + K1 脚注投影。
- Source：ingest + embed，须可被对话检索。

## 9. Cancel（A1）

`POST …/research/:rid/cancel`：协作取消；尽量落盘最后 checkpoint；状态 → `cancelled`；SSE 发 `status`（+ 可选 `log`）。

## 10. Checkpoint（B1）

- 每完成一个图节点写 checkpoint。
- 进入 `awaiting_confirm`（M1）前强制 checkpoint。

## 待钉（grill 主题）

1. graph_patch 最小字段（节点/边 payload）
2. 错误码表（与 AppHttpError 对齐）
3. （ui 已定 C1）报告/节点详情复用 CitationsControl — 写入 ui-proto 即可

## 非目标

FE/xyflow 交互 → [`deep-research-ui-proto.md`](./deep-research-ui-proto.md)
