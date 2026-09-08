# Tasks — urlpatterns-extractor-p0-2

## 1. 服务端元数据 + wire schema

- [x] `CrystalithPlugin` 增加可选 `urlPatterns?: readonly string[]`
- [x] `plugin-extractor-arxiv` 声明 `urlPatterns: [ARXIV_ABS_URL.source]`
- [x] `ExtractorMetadata` + `listExtractorMetadata()` 透出 `urlPatterns`
- [x] `ExtractorInfoSchema` 增加 `urlPatterns` 字段 + i18n key
- [x] 放宽 `SourceFromUrlRequestSchema.extractor`；`ingestFromUrl` 下沉 registry 校验
- [x] 更新 `packages/shared/test/schemas.test.ts`（arxiv extractor 可通过格式校验）

**验证**：`just check` · `just test`（server ingest + shared schema）

## 2. 前端匹配 UI

- [x] 纯函数 `matchExtractorsForUrl` + Vitest
- [x] `AddSourceFromUrlDialog`：fetch 模式推荐行 + chip 勾选；`onAdd` 传 `extractor`
- [x] `WorkspaceLayout` 传入 `extractors` / `extractorsLoading`；`handleAddSourceFromUrl` 转发 extractor
- [x] `TestIds` 新增推荐行 testid

**验证**：`just test-web`（对话框 + 匹配单测）

## 3. 端到端门禁

- [x] `just check` · `just test-web` · `just e2e` 全绿
- [x] `llman sdd validate urlpatterns-extractor-p0-2 --strict --no-interactive`

**验证**：上述命令；浏览器手测可选（arxiv URL 或临时 pattern）
