# workspace-bootstrap-endpoint-and-hydration 规范增量

## ADDED Requirements

### Requirement: Bootstrap MUST Return Shell-critical Seeds Only
系统 MUST 将 bootstrap 限定为壳层和首屏关键 seeds，而不是把所有面板数据都塞进单个响应。

#### Scenario: 前端加载 workspace 首屏
- **WHEN** 前端请求 workspace bootstrap
- **THEN** 系统 SHALL 返回足够让 shell ready 的最小数据集合
- **AND** SHALL 不要求该响应覆盖所有面板的全量数据

### Requirement: Bootstrap Response MUST Be Hydratable into Frontend Caches
系统 MUST 让 bootstrap 响应可直接 hydrate 到前端缓存与状态 slices。

#### Scenario: 前端使用 bootstrap 直接恢复首屏
- **WHEN** 前端收到 bootstrap 响应
- **THEN** 客户端 SHALL 能将其写入 SWR cache 与相关 state slices
- **AND** 随后可基于 active panel 渐进加载细节
