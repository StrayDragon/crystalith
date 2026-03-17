## ADDED Requirements

### Requirement: Authentication UI
前端 SHALL 提供登录和注册页面。未认证用户 MUST 被重定向到登录页面。系统 SHALL 自动管理 JWT token 的存储、刷新和过期处理。

#### Scenario: 未登录重定向
- **WHEN** 未认证用户访问工作区页面
- **THEN** 自动重定向到登录页面

#### Scenario: Token 过期自动刷新
- **WHEN** access token 过期且 refresh token 有效
- **THEN** 前端自动使用 refresh token 获取新的 access token，用户无感知

#### Scenario: 登出
- **WHEN** 用户点击登出按钮
- **THEN** 清除本地存储的 token，重定向到登录页面

### Requirement: Collaboration UI
工作区 SHALL 在有多用户协作时显示在线协作者列表。Notebook 共享 SHALL 通过生成分享链接实现。不同权限角色的用户 MUST 看到与其权限匹配的 UI 状态。

#### Scenario: 在线协作者显示
- **WHEN** 多个用户同时打开同一 notebook
- **THEN** WorkspaceHeader 显示所有在线协作者的头像/名称

#### Scenario: Viewer 角色只读
- **WHEN** 以 Viewer 角色打开共享 notebook
- **THEN** 消息输入框、source 上传按钮、output 生成按钮均为禁用状态
