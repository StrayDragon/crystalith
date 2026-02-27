## 1. Readiness 与空态引导

- [x] 1.1 定义 Workspace readiness 派生状态（未连接/无 notebook/无 sources/无 session/可生成）。
- [x] 1.2 增加引导式空态组件（banner/卡片/overlay），为每个 readiness 状态提供明确 CTA。
- [x] 1.3 将“自动创建默认笔记本”行为在 UI 中显式化（提示 + 入口：改名/删除/新建）。

## 2. 健康与诊断入口

- [x] 2.1 增加读取 `/health/dependencies` 的 hook，并将 optional services 状态映射为 UI 诊断条目（含 recovery_hint）。
- [x] 2.2 在 header 或全局入口加入“健康/诊断”按钮，支持查看与复制修复建议。

## 3. 命令面板与快捷键帮助

- [x] 3.1 为命令面板补齐核心动作（与 readiness CTA 对齐），并支持键盘访问。
- [x] 3.2 增加快捷键帮助入口（可访问、可关闭），并在文档中同步。

## 4. Tests

- [x] 4.1 为 readiness selector 与空态渲染增加 Vitest/RTL 测试用例。
- [x] 4.2 增加最小手动验收清单：冷启动→导入来源→QA→生成输出。
  - 冷启动：启动后端与前端，进入 Workspace 能看到“正在连接后端…”并最终进入可操作状态。
  - 导入来源：在 Sources 面板上传 `.md/.txt`，确认来源列表出现新条目。
  - QA：在 Chat 面板提问（必要时一键创建会话），确认能收到回答且无报错提示。
  - 生成输出：打开 Slides Studio 或 Studio 面板触发一次生成，确认输出出现并可打开预览。

## 5. Verification

- [x] 5.1 `cd frontend/web && pnpm test`
- [x] 5.2 `cd frontend/web && pnpm run build`
