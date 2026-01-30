## Why
用户在「来源与引用」中选中引用后，后续对话与 Studio 交互并未使用所选引用范围，表现为仍按默认检索/固定来源生成内容，导致引用范围不可控且与 UI 选择不一致。

当前代码路径中，聊天 QA 请求没有传递任何选中引用信息（仅包含 question/session_id），后端 QA 接口也不支持显式 chunk 过滤；Studio 输出虽然支持 chunk_ids，但引用选择状态与聊天/输出动作之间缺少统一传递，导致“选中引用不生效”的体验。

另外，用户在对话过程中可以随时调整左侧引用选择，但当前没有“该条对话基于哪些引用”的可视指示，导致难以理解回答所使用的引用快照。

## Minimal Repro Demo
1. 准备 Notebook：添加两个来源 A/B（内容互相区分）。
2. 发起一次对话问题，确保返回引用同时包含 A 与 B。
3. 在「来源与引用」中仅选中 B 的引用（例如只勾选 B 的条目）。
4. 触发对话提问或点击 Studio 工具生成输出。
5. 观察结果：引用范围仍包含 A 或与选择不一致。
6. 打开浏览器 Network：`POST /v1/notebooks/{id}/qa` 请求体仅包含 `question` 与 `session_id`，不包含选中引用的 `chunk_ids`，因此后端只能执行默认检索。

## What Changes
- 为 QA 接口（/qa 与 /qa/stream）增加可选 `chunk_ids`，用于显式限定上下文。
- 前端在有选中引用时将 `chunk_ids` 传递给聊天 QA 请求。
- 统一引用选择状态在对话与 Studio 输出中的使用逻辑：有选中引用则只使用选中范围，未选中则回退到默认检索。
- 在聊天消息中增加“引用范围指示器”，显示本条对话生成时使用的引用快照（来源名/数量）。
- 引用选择的交互保持可持续（不会在发送后自动清空），由用户主动清空或调整。
- 增加回归测试与验证步骤，确保选中引用不会被忽略。

## Impact
- 受影响的规范：`citation-interaction`、`rag-qa`、`refine-output`
- 受影响的代码：
  - `backend/py/src/crystalith/features/qa/api.py`
  - `backend/py/src/crystalith/shared/utils.py`（可能新增复用的上下文构建工具）
  - `frontend/web/src/features/workspace/domains/messages/useChat.ts`
  - `frontend/web/src/api/client.ts` + OpenAPI 生成文件

## Research Notes
- `selectedCitationIds` 的唯一写入口目前来自 `useSources`（`frontend/web/src/features/workspace/domains/sources/useSources.ts`），通过 `SET_SELECTED_CITATIONS`/`SET_AUTO_SELECT_CITATIONS` 写入 workspace state。
- 未发现其他 UI 组件直接维护独立的引用选择状态；因此 workspace reducer 内的 `selectedCitationIds` 应作为唯一来源（single source of truth）。
