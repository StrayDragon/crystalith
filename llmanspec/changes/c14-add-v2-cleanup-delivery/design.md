## Approach

Final cleanup phase — remove all v1 artifacts and verify v2 completeness.

### Removals

1. `git rm -rf backend/py/` — full v1 Python code
2. `git rm -rf UPGRADES/` — research docs now solidified in llmanspec
3. `git rm apps/web/src/api/generated/` — OpenAPI generated client
4. `git rm apps/web/openapi.gen.json` — OpenAPI spec cache
5. Remove `@hey-api/openapi-ts` from apps/web/package.json

### Verification Gates

All gates must pass for `v2.0.0` tag:

```bash
# 0 v1 references
grep -r "backend/py" . --include="*.md" --include="*.json" --exclude-dir=.git | wc -l  # → 0

# 0 generated client references
grep -r "generated" frontend/web/src --include="*.ts" --include="*.tsx" | wc -l  # → 0

# Full test suite
bun test                    # All packages
bun typecheck               # All packages

# Eval regression
cd apps/server && bun run eval --all-strategies --dataset golden-v1  # All pass

# Build
bun build --compile ./apps/server/src/server.ts  # Success, 3 platforms
```

### P2 RAG Strategies (post-cleanup)

- GraphRAG — entity extraction + graph traversal
- HyDE — hypothetical document embedding
- Self-RAG — self-reflective retrieval
- Managed as separate llmanspec changes post-v2

### Tag

`git tag v2.0.0` + push
