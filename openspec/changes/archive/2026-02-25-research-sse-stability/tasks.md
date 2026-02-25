## 1. useResearch：去除 stale closure 的重连 gating

- [x] 1.1 在 `useResearch` 内维护 `sessionsRef`/`activeSessionRef`（每次 state 更新同步 ref）
- [x] 1.2 修改 `scheduleReconnect`：判断是否重连时读取 ref（或在重连前调用 `fetchSession(researchId)` 获取服务端真值）
- [x] 1.3 收敛 `subscribeToSSE` 的依赖项，避免因 `sessions` 变化导致 callback 身份频繁变化与行为不可预测

## 2. 调用侧 effect 依赖与清理

- [x] 2.1 调整 `SourcesPanel` 对 `subscribeToSSE/unsubscribeFromSSE` 的依赖管理，移除 eslint 依赖抑制并保证订阅/清理严格由 `activeSession.id/status` 驱动
- [x] 2.2 确认 completed/cancelled 时立即 close EventSource，并清理 reconnect timeout 与 stale interval

## 3. 自动化测试（fake timers + mock EventSource）

- [x] 3.1 新增/更新 Vitest：模拟会话状态从活动态→completed，随后触发 error/reconnect timer，断言不会创建新 EventSource
- [x] 3.2 运行：`cd frontend/web && pnpm test`（75 passed）

## 4. 手动验收（部署后 + DevTools）

- [x] 4.1 提供部署后手动验收清单（DevTools / Network）

### 部署后手动验收清单（DevTools / Network）

- 启动后端：`cd backend/py && uv sync && just dev`
- 启动前端：`cd frontend/web && pnpm install && pnpm dev`
- Research 会话进行中打开 DevTools → Network，观察 SSE 请求保持单连接；断网/停止后端触发重连提示
- 会话进入 completed/cancelled 后，确认不再发起新的 SSE 连接（Network 中不再出现新的 stream 请求）
