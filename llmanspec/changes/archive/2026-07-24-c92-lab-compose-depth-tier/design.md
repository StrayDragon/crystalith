# Design: c92 Lab Compose depth tier

> **状态**：薄设计 · Apply 在 `feat/c92-lab-compose-depth-tier`

## 决策

| 项          | 选择                                   |
| ----------- | -------------------------------------- |
| 控件        | 三档 radio/segmented：浅 / 中 / 深     |
| 默认        | `medium`（对齐 r305 / r401）           |
| Draft       | `LabComposeDraft.depth: ResearchDepth` |
| Eden create | `ResearchCreateBody.depth` 显式发送    |
| Fixture     | MAY 展示控件；回放可不消费 depth       |

## 非目标

- 不改服务端 r305 映射
- 不触碰 runLoop / planner（c93+）
