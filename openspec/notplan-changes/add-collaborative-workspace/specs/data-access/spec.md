## ADDED Requirements

### Requirement: Notebook Sharing Data Model
系统 SHALL 支持 notebook 共享的数据模型，包含分享链接、用户权限角色（Owner/Editor/Viewer）。每个 notebook 的共享设置 MUST 独立管理。

#### Scenario: 创建分享链接
- **WHEN** notebook Owner 请求生成分享链接并指定权限级别
- **THEN** 系统生成唯一的分享链接并存储权限配置

#### Scenario: 通过分享链接加入
- **WHEN** 用户通过分享链接访问 notebook
- **THEN** 系统创建该用户与 notebook 的权限关联，赋予链接指定的角色
