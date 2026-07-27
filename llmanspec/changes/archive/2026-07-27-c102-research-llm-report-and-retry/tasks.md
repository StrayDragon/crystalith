# Tasks: c102-research-llm-report-and-retry

## Propose（本阶段）

- [x] proposal + design + live specs（runtime r328–r332 · ui r454–r455）
- [x] `llman sdd change start` / attach + `validate --strict --no-interactive`

## Apply（`llman-sdd-apply` · 独立 `sdd/c102-…` 分支）

### 1. Shared 合约

- [x] 1.1 create / Run：`modelId?`；`failureReason?`
- [x] 1.2 `ResearchRetrySynthesizeBodySchema` + response 对齐 Run
- [x] 1.3 OpenAPI `registerApiDoc` 中文 summary；`just check-app-schema` 若触及

### 2. 结案 LLM + cite 校验

- [x] 2.1 `report.ts`：LLM `ResearchReport` 成稿；禁启发式成功路径
- [x] 2.2 cite 绑定/剥离；全非法声称 → failed
- [x] 2.3 0 证据诚实成稿 → completed
- [x] 2.4 模型失败 → failed + failureReason；progress/log

### 3. retry-synthesize 命令口

- [x] 3.1 router + commands：仅结案类 failed 可调；可选 modelId 写回
- [x] 3.2 不重跑 drain/decompose；SSE status/report_ready

### 4. 节点短综合 / 无假命中

- [x] 4.1 `run-loop` work-unit 末尾短综合写回
- [x] 4.2 移除 pragmatic 假命中回退；空证据合法；失败 → missing

### 5. Lab UI

- [x] 5.1 Compose 可选 model → create body
- [x] 5.2 failed 结案条：错误 + 换模 + retry-synthesize
- [x] 5.3 Vitest 覆盖传参与触发

### 6. 验证

- [x] 6.1 `bun test apps/server/tests/research/` + 相关 web Vitest
- [x] 6.2 `bun typecheck` + `just check`（或等价）
- [x] 6.3 `llman sdd validate c102-research-llm-report-and-retry --strict --no-interactive`
