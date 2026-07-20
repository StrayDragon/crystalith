## 1. Server + docs

- [x] 1.1 嵌套路径下确认 QA POST stream、research/studio GET stream
- [x] 1.2 AsyncAPI / registerApiDoc 同步（AsyncAPI `bindings.http.method` + studio channels）
- [x] 1.3 旧扁平 stream alias 行为与文档（c69 alias 仍 GET/POST 对齐）

验证：`bun test test/asyncapi-verbs.test.ts` + research sse

## 2. Frontend

- [x] 2.1 `streamRequest` / useResearch / slides 对齐新路径与动词（c69 已嵌套；QA POST / research GET）
- [x] 2.2 更新单元测试（useChat POST、useResearch GET）

验证：相关 web stream/research tests

## 3. 门禁

- [x] 3.1 `llman sdd validate c70-unify-sse-stream-verbs --strict --no-interactive`
- [x] 3.2 `just qa`
