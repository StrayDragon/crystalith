# test-doubles-and-mocking Specification

## Purpose

定义后端测试中 test doubles（`monkeypatch`、stub、mock）使用的边界与规范，使测试尽可能对齐真实实现与真实 wiring，并减少对内部实现细节的耦合。

## Non-goals

- 不追求“零 mock”；外部边界（网络/时间/第三方服务/宿主环境）仍允许使用替身以保证确定性
- 不规定具体业务 API 语义（本规范仅约束测试写法与 seam 设计）

## Requirements

### Requirement: Service-level tests prefer real wiring
后端服务级测试（`backend/py/tests/**`）在可行范围内 MUST 使用 in-process 的真实 wiring（例如 `create_app` + `ASGITransport` + SQLite/内存实现），以覆盖真实代码路径并提升回归可信度。

#### Scenario: API test uses ASGITransport instead of mocking router internals
- **WHEN** 编写 FastAPI 路由/endpoint 的行为测试
- **THEN** 测试 SHALL 通过 `create_app(...)` 创建应用并使用 `httpx.ASGITransport` / `httpx.AsyncClient` 发起请求

### Requirement: Tests do not patch private symbols
测试代码 MUST NOT 通过 monkeypatch/mock 直接替换生产代码中的私有符号（名称以下划线开头的 `_xxx`），而应通过显式 seam（依赖注入、可替换 provider/transport、Protocol stub）实现可控与可观测。

#### Scenario: Test uses an explicit seam instead of monkeypatching a private function
- **WHEN** 测试需要控制外部依赖行为（例如网络探测、插件发现、可选依赖加载）
- **THEN** 生产代码 SHALL 提供可注入 seam
- **AND** 测试 SHALL 通过 seam 注入替身实现，而不是 patch `_xxx`

### Requirement: Test doubles are explicit and documented
任何改变运行行为的 test double（例如 `monkeypatch.setattr`、替换 provider、注入 fake loader）MUST 在测试中以 `Mock reason:` 说明动机（确定性/外部依赖隔离/覆盖异常分支等），以便评审与后续迁移。

#### Scenario: monkeypatch usage includes a nearby reason
- **WHEN** 测试使用 `monkeypatch.*` 改变运行行为
- **THEN** 测试 SHALL 在相邻位置包含 `Mock reason:` 注释说明原因

### Requirement: External boundaries use dedicated test seams
对外部边界（网络/HTTP、时间、第三方服务）进行隔离时，测试 MUST 使用明确的 seam（例如 `httpx.MockTransport`、本地 in-process server、可注入的 clock/provider），并避免通过 patch 第三方库内部实现来达成隔离。

#### Scenario: HTTP dependency is mocked at the transport boundary
- **WHEN** 测试需要模拟 HTTP 依赖的响应
- **THEN** 测试 SHALL 使用 `httpx.MockTransport` 或等价 transport-level seam 进行隔离

### Requirement: Test doubles are narrow and typed
stub/fake 实现 MUST 尽可能窄（仅实现测试所需接口），并在关键入参上断言以保证测试信号真实；`MagicMock`/宽松 mock 对象 SHOULD NOT 作为默认选择（除非用于桥接难以替代的三方 API）。

#### Scenario: Stub enforces minimal interface and validates inputs
- **WHEN** 测试引入 stub/fake 以替代外部依赖
- **THEN** stub SHALL 只实现必要方法并对关键参数做断言
