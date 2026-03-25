# http-client-pooling-and-upstream-timeout-policy 规范增量

## ADDED Requirements

### Requirement: Upstream Calls MUST Use a Shared Client Registry
系统 MUST 让对外 HTTP 调用通过共享 client registry 管理，而不是由各模块随意创建散装 client。

#### Scenario: Feature 访问外部服务
- **WHEN** 某个功能需要访问 OpenAI、SearxNG、Chroma 或等价上游服务
- **THEN** 该调用 SHALL 通过已注册的 `service_key` 获取客户端
- **AND** SHALL 复用该 `service_key` 对应的 timeout、pool 和 retry policy

### Requirement: Probe Traffic MUST Not Interfere with Primary Request Traffic
系统 MUST 区分轻探测和主请求的上游调用路径，避免 probe 污染主链路资源。

#### Scenario: 可选服务做健康探测
- **WHEN** monitor 对某个 optional service 发起 probe
- **THEN** probe SHALL 使用与主请求隔离或受控的策略
- **AND** SHALL 不把一次轻探测放大成主请求的连接池瓶颈
