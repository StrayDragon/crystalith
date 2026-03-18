# frontend-performance-marks-and-web-vitals-gates 规范增量

## ADDED Requirements

### Requirement: Critical Workspace Flows MUST Emit Stable Performance Marks
系统 MUST 为 workspace 关键流转提供稳定 performance marks，便于比较不同版本与场景。

#### Scenario: 用户进入 workspace 并打开活跃面板
- **WHEN** 用户进入 workspace 或切换到某个重面板
- **THEN** 系统 SHALL 记录 shell ready、panel ready 与等价关键 marks
- **AND** 如存在流式响应，SHALL 记录首个事件或首个 token 的时间点

### Requirement: Web Vitals MUST Be Attributable to Route and Build Context
系统 MUST 让 Web Vitals 与路由、构建版本或等价上下文绑定，避免只得到一组无法定位的慢指标。

#### Scenario: 诊断一次前端性能回归
- **WHEN** 系统记录 LCP、INP、CLS 或等价关键指标
- **THEN** 指标 SHALL 可关联到具体 route、build 或 benchmark 场景
- **AND** SHALL 能用于后续 diff 与回归比较
