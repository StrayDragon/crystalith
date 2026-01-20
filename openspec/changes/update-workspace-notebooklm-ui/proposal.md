## Why
需要将工作台 UI 像素级复刻为 NotebookLM 风格，并移除不在参考图中的功能与控件，保证整体布局与交互一致。

## What Changes
- **BREAKING**：移除移动端 Tabs、会话切换、推荐问题、输出中心配置/模板等未出现在参考图中的功能。
- 替换顶部导航为 NotebookLM 风格标题栏（标题 + 操作按钮 + 头像区）。
- 重构三栏布局为 Sources / Chat / Studio 三面板的 NotebookLM 视觉与层级。
- 将 Output/Refine 区替换为 Studio（工具格 + 笔记列表 + 添加笔记按钮）。
- 更新色板、圆角、阴影、字体与间距，移除玻璃与渐变背景。

## Impact
- 受影响的规范：`workspace-ui`
- 受影响的代码：`frontend/web/src/features/workspace/`、`frontend/web/src/app/index.css`、`frontend/web/tailwind.config.js`
