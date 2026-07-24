# Design: c100 Eden e2e production path

> **状态**：薄设计 · Apply 在 `feat/c100-lab-eden-e2e-production-path`

## 门禁定义

| 项                 | 要求                                                          |
| ------------------ | ------------------------------------------------------------- |
| 标签               | `@p0`                                                         |
| `VITE_LAB_FIXTURE` | unset / 0                                                     |
| 路径               | Compose → graph（nodes+edges）→ M1 confirm → report → convert |

## 加速策略

e2e MAY 使用 test server mock LLM / 短路径内核使 Run 在超时内到达 `awaiting_confirm` 与 `completed`；MUST NOT 切回 fixture timer 作为权威。

## 非目标

- 不删除 fixture smoke（仅不作为唯一 parity 证明）
- 不扩展产品 API
