---
depends_on: []
branch: sdd/c103-lab-demo-isolate-and-prd-skill
base_sha: 3e94c8068ccbed583cf43bea214ae70b8991b7b1
checkpointed: true
checkpoint_sha: 3e94c8068ccbed583cf43bea214ae70b8991b7b1
---

## Why

c100/c102 后产品默认已是 Eden，但 `VITE_LAB_FIXTURE` 仍与 `/research-lab` 共用入口与类型联合，双轨维护成本高、易误以为 fixture 是生产权威。需把 demo 整包隔离到 `/demo/research-lab`，产品只留 Eden；并落 `cl-prd-demo` skill 骨架，固定「先假跑定形态 → 再真接」流程。

## What Changes

1. **产品 Lab 去 fixture**：`/research-lab/:nid` MUST 仅 Eden（`useEdenLabController`）；MUST NOT 再因 `VITE_LAB_FIXTURE=1` 切换权威态。
2. **Demo 独立目录 + 路由**：xlsx-lib / `fake/*` / fixture controller MUST 迁至独立 feature 目录；路由 MUST 为 `/demo/research-lab/:nid`（及 report 子页）；仅 `import.meta.env.DEV` 或 `VITE_LAB_DEMO=1` 注册。
3. **入口隔离**：烧瓶 / slash / 任务抽屉 MUST NOT 链到 demo；产品组件 MUST NOT 保留 `LabController | Eden` 联合类型分支。
4. **`cl-prd-demo` skill**：新增 `.agents/skills/cl-prd-demo/SKILL.md`（流程骨架：定形态假跑 → inventory → Eden 接线）；本变更少代码、以文档为主。
5. **文档**：更新 `apps/web/AGENTS.md`（去掉「报告页待接」、写明 demo 路径与开关）。

## Locked decisions（explore）

- BDD-off；独立 `sdd/<id>`；编号=顺序
- Demo 路由前缀 `/demo/research-lab/...`
- 产品单 controller；demo 类型不回流
- Port 抽取 Follow-up；本波 skill 骨架（决策 14·3）
- workspace 本波仅卫生

## Capabilities

- `deep-research-ui` — 产品/demo 路径分离与入口约束

## Impact

- 主要 `apps/web/src/features/research-lab*`、`App.tsx` 路由、AGENTS、skill
- e2e `@p0` 继续 Eden + stub；不依赖 fixture
- Follow-up：C1/C2/C3；未来 `LabSessionPort` 抽离

## Seams

- `apps/web/src/app/App.tsx` — 注册 `/demo/research-lab`
- `apps/web/src/features/research-lab/` — 删 fixture 分支
- `apps/web/src/features/research-lab-demo/`（新）— 迁入 fake + fixture 页
- `.agents/skills/cl-prd-demo/SKILL.md`
- `apps/web/AGENTS.md`
