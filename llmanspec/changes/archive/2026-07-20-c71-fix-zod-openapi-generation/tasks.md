## 1. 根因与修复

- [x] 1.1 复现 `generateOpenApiDocument` / `/openapi.json` 失败并定位 Zod v4 冲突点
- [x] 1.2 升级/替换/绕过方案落地，使全量 router 文档可生成
- [x] 1.3 冒烟：关键 path（notebooks、qa、outputs、citations context）出现在文档

验证：server 启动后 curl `/openapi.json` 或单测生成不抛

## 2. 门禁

- [x] 2.1 可选 `just`/脚本检查 OpenAPI 可生成（`test/openapi-generation.test.ts`）
- [x] 2.2 `llman sdd validate c71-fix-zod-openapi-generation --strict --no-interactive`
- [x] 2.3 `just qa`（或 typecheck + 相关 server 测试）
