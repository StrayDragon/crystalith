## 1. Implementation
- [x] 1.1 移除后端 `chunk_ids` 输入与兼容逻辑（QA/Refine/Outputs/Slides/Tasks/OutputGraph）。
- [x] 1.2 后端检索逻辑仅支持 `source_ids`；Chat/Refine 空范围返回无证据；Studio/Slides 空范围返回 400。
- [x] 1.3 前端移除引用（chunk）级选择/比较/复制 UI 与状态，仅保留来源选择。
- [x] 1.4 前端 Chat / Studio / Slides 请求仅发送 `source_ids`；Studio/Slides 未选来源时禁用触发并提示。
- [x] 1.5 Slides `source_ids` 无效时返回 400 校验错误。
- [x] 1.6 更新 OpenAPI 生成与相关类型。
- [x] 1.7 更新/补充测试（QA/Refine/Outputs/Slides/UI；移除 chunk_ids 相关测试）。

## 2. Validation
- [x] 2.1 `openspec validate update-source-scope --strict --no-interactive`
- [x] 2.2 Backend: `cd backend/py && just test`
- [x] 2.3 Frontend: `cd frontend/web && pnpm test`
