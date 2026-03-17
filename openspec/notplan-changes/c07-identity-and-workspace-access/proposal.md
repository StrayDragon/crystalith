## Why

当前 Crystalith 无用户身份与访问控制机制：所有数据对所有访问者公开。这在多用户、团队使用或公网部署场景下存在安全风险。

同时，现有 Workspace 也不支持 notebook 共享与实时协作；在团队场景下（研究小组、项目团队）多人无法协同添加 source、讨论与跟进输出。身份与访问控制是协作/共享的前置条件，因此将两条提案合并为同一个 change：先把“谁能看/谁能写”立住，再把“多人协作”作为同一条主线能力落地。

## What Changes

- 身份与访问控制：
  - 用户注册/登录（邮箱+密码）
  - 基于 JWT 的会话管理（access + refresh）
  - API 端点添加认证中间件（可配置开关，支持匿名模式）
  - 数据隔离：notebook 归属 owner，查询默认按 owner 过滤
  - 前端新增登录/注册页面、路由守卫与 token 管理
- 共享与协作：
  - notebook 共享（生成分享链接、设置权限）
  - 简单权限模型（Owner / Editor / Viewer）
  - 基于 WebSocket 的实时事件同步（source 更新、新消息通知、output 完成、在线用户）
  - 协作 UI：在线协作者列表、分享入口与 Viewer 只读态（不做字符级协同编辑）

## Capabilities

### New Capabilities

- `user-auth`: 用户注册、登录、会话与认证中间件契约
- `multiplayer-review-workspace`: 共享、权限、在线状态与实时事件同步契约

### Modified Capabilities

- `workspace-ui`: 登录/注册、协作 UI 与只读态
- `workspace-api-contract`: 认证/共享/权限/WebSocket 协议与错误语义（401/409 等）
- `data-and-storage`: notebook owner 与访问隔离
- `data-access`: notebook 共享与权限数据模型

## Impact

- Backend：新增 auth feature slice + 认证中间件；引入 WebSocket、共享/权限检查与事件广播
- Database：新增 user 表；notebook 增加 owner_id；新增共享/权限相关表
- Frontend：新增登录/注册页面；API client 自动附加 Authorization；新增实时同步层与协作 UI 元素
- Config：新增 `auth` 配置段（如 `auth.enabled`、token TTL 等）；协作相关开关（如需要）
