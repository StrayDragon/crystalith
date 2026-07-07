# add-v2-core-crud — Tasks

## 1. Core Tables CRUD
- [ ] `server/src/features/notebooks/router.ts` — GET list, POST create, GET/:id, PATCH/:id, DELETE/:id
- [ ] `server/src/features/sessions/router.ts` — 同上
- [ ] `server/src/features/messages/router.ts` — GET list (pagination), POST create (user message)
- [ ] `server/src/features/sources/router.ts` — GET list, POST upload, GET/:id, DELETE/:id

## 2. Source Ingestion Pipeline
- [ ] `server/src/features/sources/parser-registry.ts` — parser 注册 (PDF/HTML/Plain text)
- [ ] `server/src/features/sources/parsers/pdf.ts` — unpdf parser
- [ ] `server/src/features/sources/parsers/html.ts` — cheerio + readability parser
- [ ] `server/src/features/sources/pipeline.ts` — 接收文件 → 判定 parser → 解析 → 分块 → embedding → ready
- [ ] 验证: `curl -F 'file=@sample.pdf' localhost:8032/v2/sources/upload` → status ready

## 3. Integration Test
- [ ] 端到端测试: 创建 notebook → 上传 PDF → 解析完成 → 在 notebook 下可见 source
- [ ] 验证: chunk 已在 chunks 表 + vec_chunks 虚拟表

## Verification
```bash
cd server
bun test src/features/
# 端到端:
curl -X POST localhost:8032/v2/notebooks -d '{"name":"test"}'
curl -F 'file=@sample.pdf' localhost:8032/v2/sources/upload?notebook_id=1
# wait... check source status
curl localhost:8032/v2/notebooks/1/sources
```
