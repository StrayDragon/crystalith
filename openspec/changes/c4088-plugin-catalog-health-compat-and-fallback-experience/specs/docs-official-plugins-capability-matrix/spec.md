# docs-official-plugins-capability-matrix 规范增量

## ADDED Requirements

### Requirement: Docs Capability Matrices MUST Reuse Runtime Plugin Truth
系统 MUST 让 docs capability matrix 复用 runtime/catalog 真相，而不是单独维护另一套插件状态解释。

#### Scenario: 文档展示官方插件能力矩阵
- **WHEN** docs 站点渲染 capability matrix 页面
- **THEN** 页面 SHALL 复用与 diagnostics/API 相同的插件命名和能力语义
- **AND** SHALL 能指向对应自检或修复入口

### Requirement: Docs Matrices MUST Stay Actionable for Installation and Troubleshooting
系统 MUST 让 capability matrix 不只是清单，而是安装和排障入口。

#### Scenario: 用户发现某项能力缺失
- **WHEN** 用户在 docs matrix 中看到某插件未安装或不可用
- **THEN** 页面 SHALL 给出典型症状与修复路径
- **AND** SHALL 与 troubleshooting/docs governance 保持一致
