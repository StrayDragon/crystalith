## 1. Zustand Store 设计
- [ ] 1.1 定义 store 的 slice 划分方案（notebooks, sessions, sources, messages, outputs, research, ui）
- [ ] 1.2 创建 Zustand store 基础结构（使用 slices pattern）
- [ ] 1.3 为每个 slice 编写类型定义

## 2. 逐领域迁移
- [ ] 2.1 迁移 notebooks slice（状态 + actions）
- [ ] 2.2 迁移 sessions slice
- [ ] 2.3 迁移 sources slice
- [ ] 2.4 迁移 messages slice
- [ ] 2.5 迁移 outputs slice
- [ ] 2.6 迁移 research slice
- [ ] 2.7 迁移 UI 状态 slice（activePanel, draft, citations 等）

## 3. Hook 适配
- [ ] 3.1 修改 useNotebooks 内部实现为 Zustand selector
- [ ] 3.2 修改 useSessions 内部实现
- [ ] 3.3 修改 useSources 内部实现
- [ ] 3.4 修改 useChat 内部实现
- [ ] 3.5 修改其余 domain hooks
- [ ] 3.6 验证 hook 对外接口不变

## 4. 清理
- [ ] 4.1 移除 WorkspaceContext 和 WorkspaceProvider
- [ ] 4.2 移除 workspaceReducer
- [ ] 4.3 更新组件树，去除 Context Provider 包裹

## 5. 验证
- [ ] 5.1 验证各面板功能正常（notebook 切换、session 切换、source 操作）
- [ ] 5.2 使用 React DevTools 检查重渲染范围是否缩小
- [ ] 5.3 运行前端测试确保无回归
