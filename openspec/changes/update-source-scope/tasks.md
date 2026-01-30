## 1. Implementation
- [ ] 1.1 更新后端 QA / Refine / Slides payload schema，支持 `source_ids`。
- [ ] 1.2 后端检索逻辑支持 `source_ids` 限定范围；空范围时返回空上下文与无证据提示。
- [ ] 1.3 前端移除引用（chunk）级选择状态与 UI，仅保留来源选择。
- [ ] 1.4 前端 Chat / Studio / Slides 请求仅发送 `source_ids`，并保持与后端一致的范围提示。
- [ ] 1.5 来源列表展示 embedding/索引状态标识（已索引/处理中/失败），并禁用非已索引来源的选择。
- [ ] 1.6 为失败来源提供“重新嵌入”入口并对接后端重试接口。
- [ ] 1.7 更新 OpenAPI 生成与相关类型。
- [ ] 1.8 更新/补充测试（QA / Refine / UI 范围选择）。

## 2. Validation
- [ ] 2.1 `openspec validate update-source-scope --strict --no-interactive`
- [ ] 2.2 Backend: `cd backend/py && just test`
- [ ] 2.3 Frontend: `cd frontend/web && pnpm test`
