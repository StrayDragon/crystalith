# Tasks: c92-lab-compose-depth-tier

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r447 + scenarios
- [x] `llman sdd validate c92-lab-compose-depth-tier --strict --no-interactive`

## Apply（`llman-sdd-apply` · 全程 main）

### 1. Draft + gate

- [x] 1.1 `LabComposeDraft` 增加 `depth: ResearchDepth`，默认 `medium`
- [x] 1.2 `labComposeGate` / Vitest：gate 规则不受 depth 影响

### 2. Compose UI

- [x] 2.1 `LabComposePanel` 三档分段按钮（浅/中/深，默认中）+ 预算副文案 + testid
- [x] 2.2 Vitest：默认中、切换档位、eden/fixture 均展示 depth（fixture 提交仍可不消费）

### 3. Eden create 传参

- [x] 3.1 `useEdenLabController` 增加 `depth` state（同 allowWeb 模式）；`composeAndStart` POST body 含所选 depth
- [x] 3.2 `ResearchLabPage` onChange 映射 depth；Vitest/mock：POST body 含 `depth`

### 4. 验证

- [x] 4.1 `cd apps/web && bun run test:ci`（相关）+ 根目录 `bun typecheck`（或 web/server 相关）
- [x] 4.2 `llman sdd validate c92-lab-compose-depth-tier --strict --no-interactive`
