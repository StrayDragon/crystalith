## ADDED Requirements

### Requirement: Collaboration UI
工作区 SHALL 在有多用户协作时显示在线协作者列表。Notebook 共享 SHALL 通过生成分享链接实现。不同权限角色的用户 MUST 看到与其权限匹配的 UI 状态。

#### Scenario: 在线协作者显示
- **WHEN** 多个用户同时打开同一 notebook
- **THEN** WorkspaceHeader 显示所有在线协作者的头像/名称

#### Scenario: Viewer 角色只读
- **WHEN** 以 Viewer 角色打开共享 notebook
- **THEN** 消息输入框、source 上传按钮、output 生成按钮均为禁用状态
