# add-v2-cleanup-delivery — Tasks

## 1. Delete v1 Python
- [ ] `git rm -rf backend/py/`
- [ ] 验证: 仓库不含 Python 代码

## 2. Delete OpenAPI Chain
- [ ] `git rm frontend/web/openapi.gen.json`
- [ ] `git rm -rf frontend/web/src/api/generated/`
- [ ] 从 package.json 移除 `@hey-api/openapi-ts`
- [ ] 验证: 前端编译无 generated client 引用

## 3. Delete UPGRADES
- [ ] `git rm -rf UPGRADES/`
- [ ] 验证: 所有决策已固化到 llmanspec

## 4. P2 RAG Strategies
- [ ] GraphRAG — entity extraction + graph traversal
- [ ] HyDE — hypothetical document embedding
- [ ] Self-RAG — self-reflective retrieval

## 5. Final Verification
- [ ] 全量端点行为对比: v1 94 端点都有 v2 对应
- [ ] Eval 回归检测全量通过
- [ ] bun build --compile 三平台成功
- [ ] `git tag v2.0.0` + push

## Verification
```bash
grep -r "backend/py" . --include="*.md" --include="*.json" --exclude-dir=.git | wc -l  # 0
grep -r "generated" frontend/web/src --include="*.ts" --include="*.tsx" | wc -l  # 0
llman sdd validate --all --strict --no-interactive  # all pass
```

