# add-v2-frontend-eden — Tasks

## 1. Eden Client Setup
- [ ] 创建 `frontend/web/src/api/client.ts` — `treaty<App>(baseUrl)` 初始化
- [ ] 验证: `const api = treaty<App>('http://localhost:8032')` 类型推断正确

## 2. Gradual Domain Migration
- [ ] notebooks domain: generated import → eden treaty
- [ ] sessions domain: generated import → eden treaty
- [ ] messages domain: generated import → eden treaty
- [ ] sources domain: generated import → eden treaty
- [ ] outputs domain: generated import → eden treaty
- [ ] analysis/studio/refine/research: 同上

## 3. Shared Schemas
- [ ] 每种 API endpoint 的 Zod schema 移入 `packages/shared/`
- [ ] Server 和 frontend import 同 schema

## 4. Cleanup (Phase 5)
- [ ] 删除 `openapi.gen.json`
- [ ] 删除 `src/api/generated/`
- [ ] 删除 `@hey-api/openapi-ts` 依赖
- [ ] 删除 package.json 中 `api:` 脚本

## Verification
```bash
cd frontend/web
bun run typecheck        # 无 generated client 引用
bun run test:ci          # 全部通过
grep -r "generated" src/ # 无匹配
```

