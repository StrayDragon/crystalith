# add-v2-cleanup-delivery — Tasks

## 1. Delete v1 Python

- [ ] `git rm -rf backend/py/`
- [ ] 验证: 仓库不含 Python 代码

## 2. Delete OpenAPI / generated client (deferred from frontend migration)

> c35 已把运行时调用迁到 eden；`apps/web/src/api/generated/` 仍有 ~18 处 **类型** import。
> 删除前必须先迁类型，否则 typecheck 会炸。

- [ ] 盘点 `apps/web/src` 中所有 `api/generated` import（类型 vs 运行时）
- [ ] 将残留类型迁到 `@crystalith/shared` 或 eden/`App` 推导类型（禁止再依赖 generated）
- [ ] 清理 `api/setup.ts` / `setupTests.ts` 等对 `generated/client.gen` 的运行时接线
- [ ] `git rm apps/web/openapi.gen.json`（若仍存在）
- [ ] `git rm -rf apps/web/src/api/generated/`
- [ ] 从 package.json 移除 `@hey-api/openapi-ts` 及相关 `api:sync` / openapi 脚本（若仍存在）
- [ ] 验证: `rg "api/generated" apps/web/src` → 0；`bun typecheck`（web）通过

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
rg "backend/py" --glob '*.md' --glob '*.json' -g '!.git' | wc -l   # expect 0 after v1 delete (docs may need rewrite)
rg "api/generated" apps/web/src                                    # expect 0
bun typecheck
llman sdd validate --all --strict --no-interactive                 # all pass
```
