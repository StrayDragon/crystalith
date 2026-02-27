## 1. Frontend：上传支持集对齐

- [x] 1.1 在 Workspace shared 层新增“支持的上传文件类型”常量（extensions/MIME/accept 字符串），作为单一真源。
- [x] 1.2 更新 `WorkspaceLayout` 的隐藏上传 input：`accept` 引用该常量并包含 `.pdf`/`application/pdf`。
- [x] 1.3 更新 `SourcesPanelView` 的预过滤逻辑：将 PDF 纳入支持集，并同步更新 tooltip/队列提示/过滤 warning 文案。
- [x] 1.4 更新前端测试：PDF 应被视为支持类型；保留一个不支持格式（如 `.docx`）用于验证过滤仍有效。

## 2. Backend：（可选）失败提示文案去误导

- [x] 2.1 检查来源解析失败路径的 `recovery_hint` 文案，避免暗示“只能转换为 txt/markdown”；调整为更通用且与官方支持集一致的建议。

## 3. Docs：（可选）支持格式说明

- [x] 3.1 在用户可发现的文档位置补充/修正“支持上传 PDF”说明，避免与 UI/SDK 示例漂移。

## 4. Verification

- [x] 4.1 `cd frontend/web && pnpm test`
- [x] 4.2 `cd frontend/web && pnpm run typecheck`
- [x] 4.3 （如涉及后端文案/逻辑）`cd backend/py && just test`
- [x] 4.4 手动验收：在 UI 中通过“选择文件”和“拖拽”两种方式上传 `.pdf` 均不应触发“不支持”提示；上传 `.docx` 应被拒绝且提示清晰。
