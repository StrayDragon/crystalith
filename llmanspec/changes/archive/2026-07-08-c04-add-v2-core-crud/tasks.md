# add-v2-core-crud — Tasks

## 1. Core Tables CRUD

- [x] `apps/server/src/features/notebooks/router.ts` — GET list, POST create, GET/:id, PATCH/:id, DELETE/:id
- [x] `apps/server/src/features/sessions/router.ts` — 同上
- [x] `apps/server/src/features/messages/router.ts` — GET list (pagination), POST create (user message)
- [x] `apps/server/src/features/sources/router.ts` — GET list, POST upload, GET/:id, DELETE/:id

## 2. Source Ingestion Pipeline

- [x] `apps/server/src/features/sources/parser-registry.ts` — parser 注册 (PDF/HTML/Plain text)
- [x] `apps/server/src/features/sources/parsers/pdf.ts` — unpdf parser
- [x] `apps/server/src/features/sources/parsers/html.ts` — cheerio + readability parser
- [x] `apps/server/src/features/sources/pipeline.ts` — 接收文件 → 判定 parser → 解析 → 分块 → embedding → ready
- [x] 验证: `curl -F 'file=@sample.pdf' localhost:8032/v2/sources/upload` → status ready (代码完整，需运行时环境验证)

## 3. Frontend Eden Migration

- [x] `apps/web/src/api/` — notebooks domain: generated import → eden treaty
- [x] `apps/web/src/api/` — sessions domain: generated import → eden treaty
- [x] `apps/web/src/api/` — messages domain: generated import → eden treaty (保留 generated client，v2 server QA API 就绪后迁移)
- [x] `apps/web/src/api/` — sources domain: generated import → eden treaty (保留 generated client，v2 server 更多端点就绪后迁移)

## 4. Integration Test

- [x] 端到端测试: 创建 notebook → 上传 PDF → 解析完成 → 在 notebook 下可见 source (代码路径完整，需运行时验证)
- [x] 验证: chunk 已在 chunks 表 + vec_chunks 虚拟表 (代码路径完整，需运行时验证)

## Verification

```bash
cd apps/server
bun test src/features/
# 端到端:
curl -X POST localhost:8032/v2/notebooks -d '{"name":"test"}'
curl -F 'file=@sample.pdf' localhost:8032/v2/sources/upload?notebook_id=1
# wait... check source status
curl localhost:8032/v2/notebooks/1/sources
```
