# Tasks — c66-research-graph-keyboard-access

> Seam：
> ① `just test-web`（LabGraph 键盘交互 Rstest——复用兄弟测试的 Rstest + testing-library + fireEvent harness，LayerProvider 包裹）
> ② `just qa`（收口）
>
> spec 编辑（T0）必须在绑定分支上进行。改动面单点（LabGraph.tsx），单 PR 一次收口。

## T0 live spec 增量

- [x] 在 `deep-research-ui.feature` r406 之后新增一条 req：键盘用户 MUST 能聚焦节点并以键盘动作打开 inspector；边 fork/prune MUST 键盘可达（MUST NOT 仅 hover）；只读态禁令对键盘路径同样适用；鼠标行为不变
- [x] `llman sdd validate` 绿
- 验证：validate 无 unbound/漂移告警

## T1 LabGraph 键盘路径 + 锁测试 [blocked-by: T0]

- [x] `LabFlowNode` 内层 `onKeyDown`（Enter/Space → node data 回调 `onSelectNode`；阻止冒泡避免画布快捷键劫持）
- [x] 边 fork/prune 按钮常驻 DOM，可见性改 `group-hover` / `group-focus-within`（按钮语义不变）
- [x] 新增 `LabGraph.keyboard.test.tsx`：Enter 打开抽屉（onSelectNode 收到节点 id）；Tab 可达边操作按钮；completed 只读态 Enter 仍可打开（抽屉只读）且边 fork/prune 按钮不渲染（对齐 design §4）
- 验证：`just test-web` 绿
- [x] `bun typecheck` 绿

## T2 收口 [blocked-by: T1]

- [x] `just qa` 全绿 → `llman sdd change finalize`
