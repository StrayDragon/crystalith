# api-regression-suite Specification

## ADDED Requirements

### Requirement: A minimal API smoke suite MUST exist
仓库 MUST 提供一套最小 API smoke suite，用于在隔离测试环境中跑通核心端点流程，并锁定关键契约（状态码与错误 envelope）。

#### Scenario: Smoke suite covers core notebook + sources flow
- **WHEN** 运行后端测试套件
- **THEN** smoke suite 至少覆盖 notebook 创建/列表、source 上传/列表/删除，以及对应错误码与 error envelope 断言

### Requirement: A DevTools verification checklist MUST exist
仓库 MUST 提供一份部署后 DevTools 验证清单（Network/Console），与 smoke suite 覆盖的核心流程对齐。

#### Scenario: Operator can verify core flows after deployment
- **WHEN** 服务部署完成并可在浏览器访问
- **THEN** 按清单可验证关键 API 请求成功/失败时的状态码与响应结构，并发现明显回归
