---
depends_on: [add-v2-distribution, add-v2-eval-harness, add-v2-frontend-eden]
---
# add-v2-cleanup-delivery — v2 清理交付

## Why

Phase 5 是 v2 的终点：删除 v1 Python 代码，前端完全切换到 v2 API，移除所有过渡期保留物，打 tag v2.0.0。

## What Changes

- **REMOVED** `backend/py/` — 完整删除 v1 Python 代码
- **REMOVED** `frontend/web/openapi.gen.json` + `frontend/web/src/api/generated/` — 删除 OpenAPI 生成链
- **REMOVED** `UPGRADES/` — 调研文档已固化到 llmanspec changes，移除
- **NEW** Eval 回归检测全量通过 (所有端点行为对比)
- **NEW** GraphRAG / HyDE / Self-RAG 策略 (P2)
- **NEW** git tag v2.0.0

## Capabilities

- architecture-core (spec delta: v1 清理后最终架构)

## Impact

- 最终仓库：~14k TS (server) + ~27k TS/React (frontend) = ~41k 行
- 单二进制分发，零 Python 依赖
