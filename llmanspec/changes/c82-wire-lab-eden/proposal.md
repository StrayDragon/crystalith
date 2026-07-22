---
depends_on: [c81-align-lab-research-api]
---

## Why

c81 已把 ResearchRun 合约与测试对齐 Lab 盘点。需要把 Lab 的 `LabSessionPort` 从 **xlsx-lib fixture 权威**切换为 **Eden + shared 校验后的 ResearchRun 权威**，完成「按 Lab 设计实现、与现有后端结合」。

## What Changes

1. **Eden 接线**：Lab 展示层经 port 调用 `…/research*`（create/list/get/stream/prune/fork/PATCH/chat/confirm/revisions/report/progress/convert）；以 SSE `graph_patch`/status/confirm 为图与状态权威。
2. **shared validate**：请求/关键以 `@crystalith/shared` research schemas 为准；FE 不平行第二套 DTO；Eden 推断类型 + 必要的运行时错误信封处理。
3. **Fixture 降级**：xlsx-lib 可保留为 demo/离线，但生产主路径 MUST NOT 以 timer/本地伪造为权威（对齐 r415）。
4. **质量**：Lab Vitest + 定向 e2e；`just qa` 相关子集；可选 smoke 脚本（慢模型不阻塞出门，但合约测必须绿）。

## Capabilities

- `deep-research-ui` — Lab ↔ Eden 薄客户端
- `frontend-eden-migration` — 若需补充 Eden 使用约束则最小 delta

## Impact

- depends_on `c81-align-lab-research-api`
- 深研主路径：Lab UI + 真 ResearchRun
- BREAKING：依赖后端与模型可用；fixture-only 演示需显式开关

## Seams

- Eden treaty research 路径
- SSE 解析与 `applyGraphPatch`
- shared `Research*` 类型
- 不含：sources.search Deep mode（已废）
