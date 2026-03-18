## 1. 用户数据模型
- [ ] 1.1 设计 user 表（id, email, password_hash, display_name, created_at）
- [ ] 1.2 为 notebook 表添加 owner_id 外键
- [ ] 1.3 创建数据库迁移
- [ ] 1.4 编写数据模型的单元测试

## 2. 认证后端
- [ ] 2.1 实现用户注册 API（邮箱验证、密码哈希）
- [ ] 2.2 实现用户登录 API（返回 JWT token）
- [ ] 2.3 实现 JWT 刷新 token 机制
- [ ] 2.4 创建认证中间件（验证 JWT、提取用户信息）
- [ ] 2.5 为现有 API 端点添加认证中间件
- [ ] 2.6 实现数据隔离（notebook 查询按 owner_id 过滤）
- [ ] 2.7 编写认证 API 和中间件的测试

## 3. 匿名模式
- [ ] 3.1 添加 auth.enabled 配置项
- [ ] 3.2 auth.enabled=false 时跳过认证中间件
- [ ] 3.3 匿名模式下所有数据归属默认用户
- [ ] 3.4 编写匿名模式的测试

## 4. 前端认证
- [ ] 4.1 创建登录页面
- [ ] 4.2 创建注册页面
- [ ] 4.3 实现 JWT token 管理（存储、刷新、过期处理）
- [ ] 4.4 添加路由守卫（未登录重定向到登录页）
- [ ] 4.5 API 客户端添加 Authorization header
- [ ] 4.6 编写前端认证流程的测试

## 5. 验证
- [ ] 5.1 验证注册→登录→访问数据的完整流程
- [ ] 5.2 验证未认证请求返回 401
- [ ] 5.3 验证用户 A 无法访问用户 B 的 notebook
- [ ] 5.4 验证匿名模式下所有功能正常

## 6. WebSocket 基础设施
- [ ] 6.1 后端添加 WebSocket 端点（基于 FastAPI WebSocket 支持）
- [ ] 6.2 实现 WebSocket 连接管理器（连接池、心跳、断线重连）
- [ ] 6.3 定义 WebSocket 消息协议（事件类型、payload 格式）
- [ ] 6.4 前端创建 useWebSocket hook
- [ ] 6.5 编写 WebSocket 连接管理的测试

## 7. Notebook 共享
- [ ] 7.1 添加 notebook_sharing 表（notebook_id, user_id, role, share_link）
- [ ] 7.2 实现生成分享链接 API
- [ ] 7.3 实现通过分享链接加入 notebook API
- [ ] 7.4 实现权限检查中间件（Owner/Editor/Viewer）
- [ ] 7.5 编写共享和权限的测试

## 8. 实时同步
- [ ] 8.1 Source 变更实时通知（添加/删除 source）
- [ ] 8.2 新消息实时推送
- [ ] 8.3 Output 生成完成通知
- [ ] 8.4 在线用户列表实时更新
- [ ] 8.5 编写实时同步的集成测试

## 9. 协作 UI
- [ ] 9.1 WorkspaceHeader 显示在线协作者头像/名称
- [ ] 9.2 Notebook 菜单添加 "分享" 选项和权限管理对话框
- [ ] 9.3 Viewer 角色的只读 UI 状态
- [ ] 9.4 编写协作 UI 交互测试

## 10. 协作验证
- [ ] 10.1 两个用户同时打开同一 notebook，一方添加 source 后另一方实时看到
- [ ] 10.2 验证 Viewer 角色无法执行写操作
- [ ] 10.3 验证网络断线后的重连和状态恢复
