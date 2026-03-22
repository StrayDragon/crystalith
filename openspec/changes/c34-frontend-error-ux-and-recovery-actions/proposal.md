## Why

现在的前端已经能把很多复杂链路串起来（SSE、后台任务、检索、生成），但只要遇到断线、超时、可选服务不可用，体验就很容易从“可控”掉到“无助”：页面卡住、提示模糊、用户不知道下一步该点哪里。

错误体验不是锦上添花，它直接决定了系统在不完美环境下还能不能用。我们需要把“错误 → 行动”做成统一规则，而不是散落在各个组件里。

## What Changes

- 统一错误分类与 UI 行动映射：
  - 网络/断线（SSE reconnect、重试按钮）
  - 上游模型错误（换模型/降级提示/重试）
  - 检索/存储错误（提示当前能力受限，给出恢复步骤）
  - 校验/参数错误（给出可操作的字段级提示）
- 统一“可复制的排障码”：所有错误提示都要能展示/复制 `correlation_id`（引用 `c12`），并能一键跳到 diagnostics（见 `c30`）。
- 收口空态与半完成态：空态不再只显示“没有数据”，而是提供明确的下一步动作（与 `c01` 的首次成功路径一致）。
- **BREAKING**（偏前端内部）：把各处的 ad-hoc error UI 升级为统一组件与约定，避免“同一种错误长成十种样子”。

## Capabilities

### New Capabilities

- `frontend-error-recovery-actions`: 错误分类、恢复动作、排障码展示与空态约定。

### Modified Capabilities

- `workspace-ui-core`: 全局 error boundary、banner/toast 规范与页面级恢复动作。
- `workspace-ui-panels`: 面板级错误与重试/取消/恢复入口的统一要求。
- `workspace-shared-ui-state`: 错误/恢复动作对共享状态的影响与幂等处理（避免重复触发）。
- `chat-ui-envelope`: SSE 断线/重连与错误事件的 UI 表达（与 `c09` 对齐）。

## Impact

- Frontend：会有一轮集中重构，但这是一次性“把体验缝起来”的工作；做完后新增功能会更省心。
- Backend：需要保证 ErrorResponse 稳定，尤其是 `code`/`message`/`correlation_id`，这样前端才能做映射（与 `c32` 相互促进）。
- Dependencies：建议先让 `c09` 统一 SSE error 表达，再落地这里的前端映射逻辑。

## Dependency Sketch

```mermaid
flowchart TD
  ERR[Error (HTTP/SSE)] --> MAP[Error category mapping]
  MAP --> ACT[Recovery actions]
  ACT --> RETRY[Retry / Reconnect]
  ACT --> SWITCH[Switch model/profile]
  ACT --> DIAG[Open diagnostics]
  MAP --> CID[Show/copy correlation_id]
```
