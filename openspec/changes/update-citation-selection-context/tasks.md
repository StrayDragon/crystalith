## 1. Backend: QA 显式引用范围
- [ ] 1.1 为 QARequest 增加可选 `chunk_ids`，校验 chunk 属于 notebook 且来源状态为 READY
- [ ] 1.2 当提供 `chunk_ids` 时，使用这些 chunk 构建上下文与 citations，跳过向量检索
- [ ] 1.3 同步更新 /qa 与 /qa/stream 的逻辑与错误处理（非法 chunk_ids 返回 400）

## 2. Frontend: 传递选中引用范围
- [ ] 2.1 更新 OpenAPI schema 并运行 `pnpm run api:generate` 同步 SDK
- [ ] 2.2 在 `useChat` 中将选中引用的 chunk_ids 传递给 askQuestion/askQuestionStream
- [ ] 2.3 确认引用选择状态为全局单一来源（workspace state），并在聊天/Studio 动作中复用
- [ ] 2.4 在聊天消息中显示“引用范围指示器”（来源名/数量），并标记为发送时的快照
- [ ] 2.5 明确引用选择清空策略（保持选择，提供手动清空）

## 3. Tests & Verification
- [ ] 3.1 后端单测：提供 chunk_ids 时仅返回这些引用；无效 chunk_ids 返回 400
- [ ] 3.2 前端单测：有选中引用时 QA 请求包含 chunk_ids
- [ ] 3.3 前端单测：聊天消息展示引用范围指示器快照
- [ ] 3.4 手动验证：选中引用后对话与 Studio 输出仅使用选中范围
