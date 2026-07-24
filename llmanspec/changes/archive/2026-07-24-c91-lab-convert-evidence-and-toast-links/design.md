# Design: c91 evidence convert + toast action links

## Scope

收口 c89 residual：节点抽屉 **per-evidence convert**，以及 convert 成功 toast 的 **可点击弱链接**。不改服务端；不实现 c90。

## Toast 最小扩展

```
toast.success(message, duration?)
toast.success(message, { duration?, action?: { label, onClick } })
```

| 字段      | 行为                                                              |
| --------- | ----------------------------------------------------------------- |
| `action`  | 可选；渲染为弱样式按钮/链接；点击后执行 `onClick`，并可关闭 toast |
| 无 action | 与现有纯消息 toast 一致                                           |

MUST NOT 引入确认对话框或平行 toast 库。

## Convert 成功导航

```
runConvertToNote / runConvertToSource 成功
  → toast.success(…, { action: { label: '打开工作区', onClick: navigateToWorkspace } })
```

导航复用 `labRouting.navigateToWorkspace`（回 `/`）。本变更不深链到具体 note/source viewer（工作区自行刷新可见）。

## Evidence 行级入口

```
LabNodeDrawer「信息引用源」列表（cites.length > 0）
  → 每条 citation 旁：转为笔记 / 转为来源
      Eden: artifact { kind: 'evidence', evidenceId: c.id }
      Fixture: stub toast「演示」
```

节点级 convert 区块（kind=node）保持不变（仍淡化，r406）。

## Mode 分支

| 能力                | Eden                          | Fixture           |
| ------------------- | ----------------------------- | ----------------- |
| evidence convert    | HTTP convert-* + toast+action | stub toast only   |
| node/report convert | 既有 + 成功 toast 带 action   | fixture stub 不变 |

## Guardrails

- MUST NOT 强制转化确认对话框（r409）
- MUST NOT 在 fixture 路径调用 Eden convert
- MUST NOT 扩大 toast API（无 queue、无 JSX message、无多 action）
- MUST NOT 实现 c90

## Testing

- Vitest：`toast` action 渲染与 onClick
- Vitest：抽屉 evidence 入口 Eden 调 `kind=evidence`；fixture 不调 API
- 既有 `edenConvertActions` 断言成功 toast 含 action
