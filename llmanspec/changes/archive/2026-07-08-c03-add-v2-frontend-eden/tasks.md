# add-v2-frontend-eden — Tasks

## 1. Eden Client Setup
- [x] 创建 `frontend/web/src/api/eden.ts` — `treaty<App>(baseUrl)` 初始化
- [x] 验证: `const api = treaty<App>('http://localhost:8032')` 类型推断正确

## 2. Gradual Domain Migration
- [ ] notebooks domain: generated import → eden treaty (defer → c04-add-v2-core-crud)
- [ ] sessions domain: generated import → eden treaty (defer → c04-add-v2-core-crud)
- [ ] messages domain: generated import → eden treaty (defer → c04-add-v2-core-crud)
- [ ] sources domain: generated import → eden treaty (defer → c04-add-v2-core-crud)
- [ ] outputs domain: generated import → eden treaty (defer → c09-add-v2-outputs-generation)
- [ ] analysis/studio/refine/research: 同上 (defer → c12-add-v2-analysis-studio-refine)

## 3. Shared Schemas
- [x] 每种 API endpoint 的 Zod schema 移入 `packages/shared/`
- [x] Server 和 frontend import 同 schema (via workspace link)

## 4. Cleanup (Phase 5)
- [ ] 删除 `openapi.gen.json` (defer → c14-add-v2-cleanup-delivery)
- [ ] 删除 `src/api/generated/` (defer → c14-add-v2-cleanup-delivery)
- [ ] 删除 `@hey-api/openapi-ts` 依赖 (defer → c14-add-v2-cleanup-delivery)
- [ ] 删除 package.json 中 `api:` 脚本 (defer → c14-add-v2-cleanup-delivery)

## Verification
```bash
cd frontend/web
bun run typecheck        # 无 generated client 引用
bun run test:ci          # 全部通过
grep -r "generated" src/ # 无匹配
```
