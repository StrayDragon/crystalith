# Design：c66-research-graph-keyboard-access

## 1. Spec 增量（已在绑定分支落地）

`deep-research-ui.feature` r406 之后新增 `@req:r15`（Graph keyboard access parity）：键盘 MUST
能聚焦节点并以 Enter/Space 打开 inspector；边 fork/prune MUST 键盘可达（MUST NOT 仅 hover）；
只读禁令键盘/鼠标同等适用；不改变既有鼠标行为。

## 2. 节点键盘路径（LabFlowNode 内部处理，非全局键盘表）

- **决策**：在自定义节点组件 `LabFlowNode` 内层 div 上加 `onKeyDown`，而不是画布级全局
  keymap。理由：xyflow v12 已默认给节点 `tabindex`（`nodesFocusable` 默认 true），焦点
  管理是库的职责；全局表会与库内键盘语义打架。
- `NodeProps` 自带 `id`，无需塞进 data；`onSelectNode` 回调经 node data 传入（与边 data
  携带 `onFork`/`onPrune` 同构，在 rfNodes 构建的 useMemo 里接线）。
- 键位：Enter 与 Space 都触发（按钮语义）；Space `preventDefault` 防页面滚动；
  `e.stopPropagation()` 防止冒泡进 xyflow/画布级 handler。

## 3. 边操作键盘可达（状态 + CSS 混合，保留 hover 行为）

现状：`EdgeLabelRenderer` 内容仅在 `hovered` 态渲染（`hovered ? (...) : null`），hover
检测靠透明 28px path 的 `onMouseEnter/onMouseLeave`；按钮不渲染时键盘无从触达。

- **决策**：内容**常驻渲染**，可见性改为 class 控制：`opacity-0 pointer-events-none` 为
  基态；`hovered` 态（保留 path 的 mouseenter/leave，维持现有鼠标体验——热区仍是宽
  path 而非标签中心）与 `group-focus-within`（wrapper 加 `group`）都切到
  `opacity-100 pointer-events-auto`。
- 纯 CSS `group-hover` 方案被否：会把 hover 热区从 28px 宽 path 缩到标签本体，改变既有
  鼠标体验，违反 r15 的「MUST NOT 改变既有鼠标交互行为」。
- 按钮本就是 `<button type="button">`，常驻 DOM 后 Tab 序即边序，无需额外 tabindex。

## 4. 只读态语义（对齐 r406/r126，不是「打不开」）

- 只读禁令针对 **prune/fork 动作**，不针对打开 inspector：r126 要求终态时节点抽屉
  MUST 反映服务端终态文案——即终态**仍要能打开**抽屉（内容只读）。
- 键盘路径自动继承现有门控：边按钮仅在 `d.canFork/canPrune` 时渲染（adapter 按状态
  置位），终态下按钮不存在，键盘自然不可触发；节点 Enter 各状态均可打开抽屉。
- 锁测试相应断言：completed 态 Enter 仍调用 `onSelectNode`（抽屉只读）；completed 态
  边操作按钮不渲染。

## 5. 测试 seam

复用兄弟测试 harness：Rstest + `@testing-library/react` + `fireEvent`，`LayerProvider`
包裹（LabGraph 不依赖 Layer 上下文，但保持一致；如 xyflow 需Provider 则包
`ReactFlowProvider`——LabGraph 内部已自带）。断言面：`onSelectNode` mock 收到节点 id；
边按钮 `document.activeElement` 可达性与可见性。
