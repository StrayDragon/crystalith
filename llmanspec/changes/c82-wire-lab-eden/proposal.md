---
depends_on: [c81-align-lab-research-api]
---

## Why

c81 已把 ResearchRun 合约与测试对齐 Lab 盘点（含任务列表 list/create）。需要把 Lab 的 `LabSessionPort` 从 **xlsx-lib / demoResearchTasks 权威**切换为 **Eden + shared 校验后的 ResearchRun 权威**，打通闭环：Compose 真创建 → 任务抽屉真 list → Lab 真图流。

## What Changes

1. **Eden 接线**：
   - Compose → `POST …/research`
   - 任务抽屉（工作区头像旁 **与 Lab 顶栏最右**）→ `GET …/research`（+ 可选 status 过滤/摘要）
   - 切换任务 → `GET …/:rid` + `stream`
   - 图表面 → prune/fork/PATCH/chat/confirm/revisions/report/progress/convert
2. **shared validate**：`@crystalith/shared` research schemas；无平行 wire DTO。
3. **Fixture 降级**：xlsx-lib / demoResearchTasks 仅 `CL_LAB_FIXTURE=1`（或等价）；默认 MUST NOT timer/本地伪造为权威。
4. **入口**：Compose + 烧瓶/抽屉；**不含**对话 `@`/`/`（明确延后另 change）。
5. **质量**：Lab Vitest + 定向 e2e（任务抽屉打开/切换；Compose 创建后 badge）；server research 回归绿。

## Capabilities

- `deep-research-ui` — Lab ↔ Eden（Compose + 任务队列 + 作业台）
- `frontend-eden-migration` — 若需补充 Eden 约束则最小 delta

## Impact

- depends_on `c81-align-lab-research-api`
- 深研主路径：真 ResearchRun + Lab UI + 统一任务列表
- BREAKING：依赖后端与模型；fixture-only 需显式开关

## Seams

- Eden treaty research 路径（create/list/get/stream/…）
- 任务抽屉数据源切换 demo → listRuns
- SSE / `applyGraphPatch`
- shared `Research*` 类型
- 不含：sources.search Deep mode（已废）；对话 `@`/`/` 嵌入
