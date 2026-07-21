# Deep Research — Runtime Spec（草案）

| 字段        | 值                                                      |
| ----------- | ------------------------------------------------------- |
| 状态        | Draft — grill 进行中（R1′ D1 已定）                     |
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

## 待钉（grill 主题）

1. Run 状态枚举与 stream 事件
2. Tool 输入/输出与 checkpoint 粒度
3. Report JSON 形状与脚注 serializer
4. convertToNote / convertToSource 请求体（artifactRef）
5. 错误码与取消语义

## 非目标

FE/xyflow 交互 → [`deep-research-ui-proto.md`](./deep-research-ui-proto.md)
