## 1. 抽取共享 retrieval/context 管线

- [x] 1.1 盘点 `ask_question` 与 `ask_question_stream` 的重复段落，定义共享输入/输出结构（内部 model / dataclass）
- [x] 1.2 实现共享 pipeline（校验 source_ids 归属、embedding、vector search、chunks 装配、citations/context/evidence/confidence 计算）
- [x] 1.3 将 pipeline 放置在清晰模块边界（`features/qa/service.py` 或 `shared/retrieval`），并为其补齐类型标注

## 2. 端点重构（保持外部行为不变）

- [x] 2.1 修改 `ask_question`：调用共享 pipeline 并使用其产物生成非流式响应
- [x] 2.2 修改 `ask_question_stream`：调用共享 pipeline，并在 `done` 事件中返回与非流式一致的 metadata
- [x] 2.3 确保错误码与 error envelope 语义保持一致（无效 source_ids → 400；无证据提示保持既有行为）

## 3. 自动化测试（防止分叉回归）

- [x] 3.1 新增测试：同一输入分别调用两条端点，断言 `citations/evidence/confidence/context` 一致（以流式 `done` 为准）
- [x] 3.2 运行：`cd backend/py && just test`（368 passed，coverage 85.35%）

## 4. 手动验收（部署后 + DevTools）

- [x] 4.1 提供部署后手动验收清单（DevTools / Network）

### 部署后手动验收清单（DevTools / Network）

- 启动后端：`cd backend/py && uv sync && just dev`
- 触发非流式：`POST /v1/notebooks/{id}/qa`，确认 `citations/evidence/confidence/context` 返回结构正确
- 触发流式：`POST /v1/notebooks/{id}/qa/stream`，观察 `done` 事件并确认其 `citations/evidence/confidence/context` 与非流式一致
