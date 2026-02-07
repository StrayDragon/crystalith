## Why

当前系统在前端缺少全局错误边界，后端的外部服务调用（AI provider、embedding、web extraction）缺少统一的重试和降级策略。当 AI 服务暂时不可用或网络抖动时，用户会看到未处理的错误，体验较差。引入全面的错误恢复机制可提升系统的健壮性和用户体验。

## What Changes

- 前端：添加全局 ErrorBoundary 和领域级 ErrorBoundary
- 前端：关键操作（发送消息、生成输出）添加 retry 按钮
- 后端：AI provider 调用添加统一的重试策略（exponential backoff）
- 后端：外部服务调用（embedding、web extraction）添加超时和降级
- 后端：定义标准化的错误响应格式

## Impact

- 受影响的规范：`backend-module-structure`（MODIFIED），`workspace-ui`（MODIFIED）
- 受影响的系统：
  - 前端组件树（ErrorBoundary 包裹）
  - 后端 AI 调用路径
  - 后端 extraction 服务
