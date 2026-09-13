# language: zh-CN
# capability: web-ui-foundation
# purpose: 定义 Crystalith Web 共享 UI 基础层：展示件自研、行为件 headless、弹层走统一 Layer；替换组件库不得破坏 testid 与视觉 token。
# scope: apps/web/

功能: web-ui-foundation

  @req:web-ui-shared-primitives @human
  场景: Display primitives live in the shared UI layer
    - Web 应用 MUST 将可复用展示件（按钮、图标按钮、文字、加载指示、标签及同等浅层控件）放在共享 UI 层，供各业务面复用。
    - 业务面 MUST NOT 为同一展示语义再引入第三套组件库实现。

  @req:web-ui-headless-behavior @human
  场景: Interactive overlays use headless primitives plus Layer
    - 菜单、popover 与 tooltip 的焦点管理、键盘导航、定位与 ARIA MUST 由 headless 原语（Radix 或同等）提供，样式壳 MUST 接入统一 Layer。
    - 这些行为件 MUST NOT 硬编码 z-index（见 workspace-ui-core 弹层策略）。

  @req:web-ui-dialog-overlay @human
  场景: Dialogs share one overlay policy
    - 模态对话框 MUST 使用与既有工作区对话框相同的 overlay 策略：portal、焦点陷阱、Esc/遮罩关闭，以及 modal Layer。
    - 系统 MUST NOT 再并列一套与 Layer 无关的对话框运行时作为默认实现。

  @req:web-ui-testid-stable @human
  场景: Replacement preserves stable test anchors
    - 替换基础组件库时，浏览器 @p0 所依赖的稳定 testid 锚点与可访问名 MUST 保持不变。
    - 新基础件 MUST 透传调用面提供的 testid。

  @req:web-ui-no-material-tailwind @human
  场景: Runtime MUST NOT depend on Material Tailwind
    - 前端运行时依赖与应用源码 MUST NOT 再引用 Material Tailwind React 包（含其主题包装与配置包装器）。
    - Tailwind 配置 MUST NOT 再经该库的配置包装生成。

  @req:web-ui-visual-tokens @human
  场景: Tokens stay on the existing design system
    - 共享 UI 层的颜色与排版 MUST 对齐既有设计系统 token 与语义色；本能力的组件替换 MUST NOT 借机重做产品视觉。
    - 图标集 MAY 继续使用现有图标包；MUST NOT 把图标替换绑进本能力。

  @req:web-ui-no-material-tailwind @executable
  场景: source-and-deps-do-not-reference-material-tailwind
    假如 前端工程可被静态检查
    当 扫描运行时依赖与源码导入
    那么 运行时依赖不包含 Material Tailwind React 包
    而且 源码导入不引用该包

  @req:web-ui-testid-stable @executable
  场景: p0-anchors-survive-component-replacement
    假如 浏览器 @p0 套件存在
    当 运行 Playwright @p0
    那么 用例经稳定 testid 锚点通过
