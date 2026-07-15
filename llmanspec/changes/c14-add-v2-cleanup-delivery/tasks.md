# add-v2-cleanup-delivery — Tasks

## 1. Delete v1 Python

- [x] `git rm -rf backend/py/`
- [x] 验证: 仓库不含 Python 代码（`data/` 目录下 chroma Docker root-owned files 除外，已 gitignore）

## 2. Delete OpenAPI / generated client (deferred from frontend migration)

> c35 已把运行时调用迁到 eden；`apps/web/src/api/generated/` 原有 ~18 处 **类型** import。
> 删除前必须先迁类型，否则 typecheck 会炸。

- [x] 盘点 `apps/web/src` 中所有 `api/generated` import（类型 vs 运行时）
- [x] 将残留类型迁到 `api/shared-types.ts`（~80 行新类型定义）
- [x] 清理 `setupTests.ts` / `useChat.test.tsx` 对 `generated/client.gen` 的运行时接线（替换为本地 mock）
- [x] `git rm apps/web/openapi.gen.json`（已删除）
- [x] `git rm -rf apps/web/src/api/generated/`（已删除）
- [x] 从 package.json 移除 `@hey-api/openapi-ts` 及相关 `api:sync` / openapi 脚本（若仍存在）
- [x] 验证: `rg "api/generated" apps/web/src` → 0；`bun typecheck`（web）通过

## 3. Delete UPGRADES

- [x] `git rm -rf UPGRADES/`
- [x] 验证: 所有决策已固化到 llmanspec

## 4. P2 RAG Strategies（延迟改进，非 c14 范围）

- [ ] GraphRAG — entity extraction + graph traversal（延迟改进）
- [ ] HyDE — hypothetical document embedding（延迟改进）
- [ ] Self-RAG — self-reflective retrieval（延迟改进）

## 5. Final Verification（已完成核心验证）

- [x] 全量端点行为对比: 见 `_WEB_DELTA.md` 和本次会话的综合比较报告
- [x] E2E 冒烟验证通过（CDP: workspace + source summary + QUIZ）
- [ ] bun build --compile 三平台成功（c13 范围）
- [ ] `git tag v2.0.0` + push（取消 — 暂不打 tag）

## Verification

```bash
rg "backend/py" --glob '*.md' --glob '*.json' -g '!.git' | wc -l   # expect 0 after v1 delete (docs may need rewrite)
rg "api/generated" apps/web/src                                    # expect 0
bun typecheck
llman sdd validate --all --strict --no-interactive                 # all pass
```
