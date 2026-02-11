> **范围说明**: Phase 1 仅迁移三个核心模块（来源、对话、Studio）到 Modular Canvas。研究、图谱、分析、Refine 等非核心模块暂不 widget 化，后续迭代处理。

## 1. 基础设施

- [x] 1.1 将 gridstack 添加到 `frontend/web/package.json` 正式依赖
- [x] 1.2 搭建 GridStack 初始化逻辑：创建 GridStack 实例，配置 12 列网格、margin、cellHeight
- [x] 1.3 实现 React Portal 桥接：在 GridStack 创建的 DOM 容器内通过 `createPortal` 渲染 React 组件
- [x] 1.4 实现动态 cellHeight 计算（ResizeObserver 监听容器高度变化，自动调整行高）
- [x] 1.5 实现 widget 添加/移除 API（封装 `gs.addWidget` / `gs.removeWidget`，与 React 状态同步）
- [x] 1.6 实现 widget 生命周期同步（GridStack widget 增删时同步创建/销毁 React Portal）

## 2. 从原型迁移到正式代码

- [x] 2.1 将 `ModularCanvasDemo.tsx` 中的 GridStack 桥接逻辑提取为通用的 `ModularCanvas` 布局组件
- [x] 2.2 用 `ModularCanvas` 替换现有 `WorkspaceLayout` 的固定三栏布局
- [x] 2.3 清理原型文件（`prototypes/` 目录下不再需要的 demo 文件）

## 3. 功能模块 Widget 化

- [x] 3.1 将来源面板（SourcesPanelView）注册为独立 widget，自适应容器尺寸
- [x] 3.2 将对话面板（ChatPanel）注册为独立 widget，自适应容器尺寸
- [x] 3.3 将 Studio 面板（StudioPanel）注册为独立 widget，自适应容器尺寸
- [x] 3.4 为每个 widget 定义元数据：标签、图标、默认尺寸（w/h）、最小尺寸（minW/minH）

## 4. Studio 工具区可收纳

- [x] 4.1 在 Studio widget 内实现工具区标题栏双击折叠/展开
- [x] 4.2 折叠时以 200ms ease 动画隐藏工具网格，输出/笔记列表扩展占满
- [x] 4.3 展开时以 200ms ease 动画恢复工具网格
- [x] 4.4 确保单击标题栏不触发折叠/展开
- [x] 4.5 折叠状态保存到 localStorage，打开页面时恢复
- [x] 4.6 折叠状态下显示明显视觉提示（如收起图标 + "双击展开"tooltip）

## 5. 模块目录

- [x] 5.1 实现模块目录弹窗 UI（顶栏"添加模块"按钮触发）
- [x] 5.2 展示可添加 widget 列表，标注已在画布中的 widget
- [x] 5.3 点击条目添加 widget 到画布

## 6. ⌘K 命令面板

- [x] 6.1 实现命令面板 UI（⌘K/Ctrl+K 触发，输入框 + 命令列表 + 模糊搜索）
- [x] 6.2 注册核心命令：添加/移除各模块、锁定/解锁布局
- [x] 6.3 命令面板选择后执行命令并自动关闭

## 7. 锁定/编辑模式

- [x] 7.1 实现锁定/编辑模式切换（顶栏按钮，默认锁定）
- [x] 7.2 锁定时调用 `gs.enableMove(false)` + `gs.enableResize(false)`
- [x] 7.3 编辑时恢复拖拽和缩放，widget 显示边框/手柄视觉提示

## 8. 默认布局与顶栏

- [x] 8.1 设置默认三栏布局：来源(x:0,w:3,h:6) | 对话(x:3,w:6,h:6) | Studio(x:9,w:3,h:6)
- [x] 8.2 实现顶栏：笔记本切换器、"添加模块"按钮、锁定/解锁按钮、⌘K 按钮

## 9. 验证

- [x] 9.1 验证默认三栏布局正确渲染（来源 + 对话 + Studio 三个 widget 可见）
- [x] 9.2 验证编辑模式下 widget 拖拽定位正常（移动后网格对齐）
- [x] 9.3 验证编辑模式下 widget 缩放正常（内容自适应）
- [x] 9.4 验证锁定模式下 widget 不可移动和缩放
- [x] 9.5 验证 Studio 工具区双击折叠/展开（含动画和 localStorage 持久化）
- [x] 9.6 验证模块目录可添加/移除 widget
- [x] 9.7 验证 ⌘K 命令面板可执行添加/移除/锁定命令
- [x] 9.8 验证来源面板核心功能可达：上传、搜索、选择、来源详情
- [x] 9.9 验证对话面板核心功能可达：发送消息、流式响应、引用、保存笔记
- [x] 9.10 验证 Studio 核心功能可达：工具选择、生成触发、输出查看/导出/删除、笔记编辑
