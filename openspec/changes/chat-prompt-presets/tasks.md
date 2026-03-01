## 1. Backend: Feature Flags & Preset Routing

- [ ] 1.1 在 `backend/py/src/crystalith/shared/config/models.py` 增加 `app.features.chat_prompt_presets_enabled` 与 `app.features.chat_ui_envelope_enabled`（默认均为 `false`），并运行 `cd backend/py && just config-schema` 更新 `config/app.schema.json`。
- [ ] 1.2 在 QA 非流式与流式端点（`backend/py/src/crystalith/features/qa/api.py`）加入 `/prompt:<preset> <query>` 解析：unknown preset / empty query / presets disabled 返回稳定 400（stream 走 `error` 事件）。
- [ ] 1.3 实现后端 preset registry（建议 `backend/py/src/crystalith/features/qa/presets.py`）：定义 `stats` preset（id、描述、system prompt、输出模型、envelope 映射）。

## 2. Backend: Stats Preset（结构化输出 + 安全回退）

- [ ] 2.1 为 `stats` preset 定义 Pydantic 输出模型（`fallback_markdown`、`chart`、`table?`）并实现“严格 JSON 解析 + 子串抽取兜底”的解析器；解析失败回退到默认 QA 文本生成。
- [ ] 2.2 在 `stats` preset 路径中复用 QA retrieval/context/citations（不改变 citations/evidence/confidence 语义），但用 preset 的 system prompt 约束模型输出为 JSON。
- [ ] 2.3 当 `app.features.chat_ui_envelope_enabled=true` 时，将 stats 结果包裹为 UI envelope 并写入 assistant `Message.content`（否则仅写入 `fallback_markdown`）。

## 3. Backend: UI Envelope 剥离（导出/转换/LLM history）

- [ ] 3.1 增加 `strip_ui_envelope(content)->fallback_text` 与 `embed_ui_envelope(fallback_text,envelope)->content` 工具（建议 `backend/py/src/crystalith/shared/chat_ui_envelope.py`），并在所有需要“纯正文”的读路径使用 `strip_ui_envelope`。
- [ ] 3.2 QA export（`backend/py/src/crystalith/features/qa/api.py`）导出 Markdown/JSON 时使用 `strip_ui_envelope(assistant_message.content)` 作为 `answer`/正文。
- [ ] 3.3 Session convert（`backend/py/src/crystalith/features/sessions/api.py`）提取 messages 文本时对 assistant 内容做 `strip_ui_envelope`，避免转换产物混入 delimiter/JSON。
- [ ] 3.4 QA 会话历史喂给 LLM（`backend/py/src/crystalith/features/qa/service.py#load_session_history`）时对 assistant 内容做 `strip_ui_envelope`，避免 JSON 元数据污染 prompt。

## 4. Backend: CSV 摄取与分块

- [ ] 4.1 新增 `CSVParser`（建议 `backend/py/src/crystalith/shared/parsers/csv.py`）：UTF-8 解码、首行 header、按 `max_rows_per_chunk=50` 分块输出 Markdown table，并在 chunk metadata 标注 `csv_row_start/csv_row_end`。
- [ ] 4.2 更新 `backend/py/src/crystalith/shared/parsers/factory.py`：优先按 `text/csv` 或 `.csv` 选择 `CSVParser`；并更新 `TextParser` 支持集（补充 `.csv`/`text/csv` 作为兜底识别）。
- [ ] 4.3 覆盖 ingest 错误提示文案（如存在硬编码“支持 .txt/.md/.markdown/.pdf”）使其包含 `.csv`。

## 5. Frontend: Tambo 展示侧集成 + UI Envelope 渲染

- [ ] 5.1 安装依赖：在 `frontend/web` 添加 `@tambo-ai/react` 与 `zod`；保持现有 Vite/Tailwind 模式不变。
- [ ] 5.2 新增 `TamboProvider` 装配（例如在 `frontend/web/src/main.tsx` 或 Workspace 根组件处）：只注入 `components` registry，不配置 apiKey，不启用 threads。
- [ ] 5.3 新增组件与 schema：
  - `BarChartCard`（条形图）
  - `DataTableCard`（可选，展示聚合表格）
  并在 registry 中注册（Zod propsSchema 必须可选字段友好）。
- [ ] 5.4 实现 `parseChatUiEnvelope(content)`：按 delimiter 分割并做资源上限（bytes/parts/depth）限制；失败回退到 `fallback_text`。
- [ ] 5.5 改造 `frontend/web/src/features/workspace/domains/messages/ChatPanel.tsx`：assistant 消息若存在 envelope 则渲染 parts；`component` parts 走 registry 渲染（失败走 JSON fallback）；无 envelope 保持现状文本渲染。

## 6. Frontend: CSV 上传支持

- [ ] 6.1 更新 `frontend/web/src/features/workspace/shared/uploadTypes.ts`：支持扩展名 `csv` 与 MIME `text/csv`，并确保提示文案与过滤逻辑一致。

## 7. Tests & Verification

- [ ] 7.1 Backend pytest：覆盖 `/prompt:*` 解析（disabled/unknown/empty）、stats JSON 解析回退、`strip_ui_envelope`、CSVParser 分块。
- [ ] 7.2 Frontend Vitest：覆盖 envelope 解析上限与回退、component 渲染回退、上传 accept 列表包含 CSV。
- [ ] 7.3 手工验收：
  - 启用 `chat_prompt_presets_enabled=true`：在 Chat 输入 `/prompt:stats <query>`，得到可读摘要（含 citations）。
  - 启用 `chat_ui_envelope_enabled=true`：同一请求返回条形图组件；刷新后仍可回放渲染。
  - 上传 `.csv`：成功 ingest，且可被检索用于 stats preset。
