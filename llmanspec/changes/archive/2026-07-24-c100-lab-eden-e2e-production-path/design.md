# Design: c100 Eden e2e production path

> **状态**：Apply 锁定 · 全程 **main**
>
> **Locked 2026-07-24**：L1=A+B · L2=A · L3=C · L4=A+B · L5=A+B+D · L6=截图+run JSON 附件

## 加速（L1）

| 层     | 机制                                                                      |
| ------ | ------------------------------------------------------------------------- |
| A stub | `CL_RESEARCH_E2E_STUB=1` → 确定性 decompose + 无 SearXNG 时 stub web hits |
| B mock | `e2e/mock-openai-gateway.ts` → `CL_CHAT_API_BASE` / embedding 指本地网关  |

## 用例（L2=A · L3=C · L4=A+B）

单条 `@p0` `p0-eden-lab.spec.ts`：

1. Compose → graph（nodes+edges）→ **budget** continue → completed → report → **convert note + source**
2. 再开一轮：budget 时 API fork → **expand_branch** approve → completed

## 环境（L5）

- webServer 清 `VITE_LAB_FIXTURE`（强制 Eden）
- fixture smoke（如 S06b）保留，但**不是**生产 parity 替代
- fixture 代码删除另议（D）

## 诊断（L6）

- Playwright：`screenshot` / `trace` / `video` = retain-on-failure
- 失败与关键 checkpoint：`attachResearchDiagnostics` 附加全页截图 + `GET research/:rid` 精简 JSON + URL

## 非目标

- 不删 fixture
- 不扩展产品 API
