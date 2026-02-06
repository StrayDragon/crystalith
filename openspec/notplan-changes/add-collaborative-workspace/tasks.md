## 1. WebSocket 基础设施
- [ ] 1.1 后端添加 WebSocket 端点（基于 FastAPI WebSocket 支持）
- [ ] 1.2 实现 WebSocket 连接管理器（连接池、心跳、断线重连）
- [ ] 1.3 定义 WebSocket 消息协议（事件类型、payload 格式）
- [ ] 1.4 前端创建 useWebSocket hook
- [ ] 1.5 编写 WebSocket 连接管理的测试

## 2. Notebook 共享
- [ ] 2.1 添加 notebook_sharing 表（notebook_id, user_id, role, share_link）
- [ ] 2.2 实现生成分享链接 API
- [ ] 2.3 实现通过分享链接加入 notebook API
- [ ] 2.4 实现权限检查中间件（Owner/Editor/Viewer）
- [ ] 2.5 编写共享和权限的测试

## 3. 实时同步
- [ ] 3.1 Source 变更实时通知（添加/删除 source）
- [ ] 3.2 新消息实时推送
- [ ] 3.3 Output 生成完成通知
- [ ] 3.4 在线用户列表实时更新
- [ ] 3.5 编写实时同步的集成测试

## 4. 协作 UI
- [ ] 4.1 WorkspaceHeader 显示在线协作者头像/名称
- [ ] 4.2 Notebook 菜单添加 "分享" 选项和权限管理对话框
- [ ] 4.3 Viewer 角色的只读 UI 状态
- [ ] 4.4 编写协作 UI 交互测试

## 5. 验证
- [ ] 5.1 两个用户同时打开同一 notebook，一方添加 source 后另一方实时看到
- [ ] 5.2 验证 Viewer 角色无法执行写操作
- [ ] 5.3 验证网络断线后的重连和状态恢复
