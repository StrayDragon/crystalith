---
name: cl-prd-demo
description: >
  Demo-first product shaping for Crystalith Lab surfaces: lock UX with a fake
  demo under /demo/..., inventory Keep/Gap vs real APIs, then propose/apply an
  Eden wire-up change. Use when prototyping deep-research (or similar) UI before
  ResearchRun authority, or when isolating demo from product paths. Invoke via
  /cl-prd-demo.
---

# cl-prd-demo — Demo-first → Eden 接线

固定「先假跑定形态，再真接权威」的流程骨架。本 skill **不以第二套生产编排 SSOT 为目标**；权威态仍走 Eden / ResearchRun 命令口。

## When to use

- 新产品面交互未定，需要可点击假跑锁定文案与流程
- 已有 demo（如 `/demo/research-lab`）要收敛进产品 Eden 路径
- 避免在产品 `/research-lab` 上用 env 开关切 fixture 权威

## Non-goals

- 不实现完整 `LabSessionPort` 抽象（除非单独 SDD change）
- 不把 demo controller 类型回流为产品页 `LabController | Eden` 联合分支
- 不另立与 ResearchRun 平行的过程态 SSOT

## Pipeline

```text
1. Demo 假跑定形态
   → /demo/...（DEV 或 VITE_LAB_DEMO=1）用 fake / fixture 锁定交互与文案
2. Inventory
   → Keep（可直接复用展示） / Gap（需真 API / 命令口）对照表
3. Propose Eden 接线
   → llman-sdd-propose：产品路径仅 Eden；demo 保持隔离前缀
4. Apply → Verify
   → 产品入口（烧瓶 / slash / 任务抽屉）只链产品路径
5. 可选收口
   → demo 收窄、标注废弃，或保留为 DEV 演练面
```

### 1) Demo 假跑定形态

- 路由前缀：`/demo/<surface>/...`（深研现为 `/demo/research-lab/:nid`）
- 门控：`import.meta.env.DEV || import.meta.env.VITE_LAB_DEMO === '1'`
- 产品路径 **MUST NOT** 因旧 `VITE_LAB_FIXTURE` 切换权威
- 演示数据与 controller 放独立 feature 目录（如 `research-lab-demo/`）

### 2) Inventory（Keep / Gap）

产出简表即可：

| UI / 行为 | Keep（展示可复用） | Gap（需 Eden / 服务端） |
| --------- | ------------------ | ----------------------- |
| …         | …                  | …                       |

Gap 项必须映射到既有或新建的 HTTP 命令口 / SSE，禁止 tool execute 静默改图。

### 3) Propose → Apply

- 走 `/llman-sdd-propose` → `/llman-sdd-apply` → `/llman-sdd-verify`
- Specs 写清：产品路径 Eden-only；demo 前缀与注册条件；入口隔离

### 4) 入口约束（验收）

- 烧瓶 / slash / 任务抽屉 → 仅产品路径
- 产品页无 `LabController | Eden` 联合 `as` 分支
- e2e `@p0` 不依赖 fixture

## Crystalith 现状锚点

| 面       | 路径                                 | 权威                          |
| -------- | ------------------------------------ | ----------------------------- |
| 产品 Lab | `/research-lab/:nid` (+ report)      | Eden `useEdenLabController`   |
| Demo Lab | `/demo/research-lab/:nid` (+ report) | `fake/*` + fixture controller |

详见 `apps/web/AGENTS.md` Research Lab 节。
