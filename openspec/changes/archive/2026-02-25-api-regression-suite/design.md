## Context

- 现有测试基础设施提供了 ASGI `client` fixture（httpx AsyncClient）与隔离的 SQLite 测试库、in-memory vector store/cache。
- 目前端点级 smoke 覆盖不足，导致 API 行为（状态码、错误 envelope、基本流程）容易回归。

## Goals / Non-Goals

**Goals:**
- 为核心用户路径提供最小端点级回归覆盖（不依赖外部网络服务/真实 LLM）。
- 明确错误响应 envelope 与关键状态码的断言（404/400/422/415 等）。
- 提供部署后 DevTools 手动验证清单，便于在真实环境/浏览器里快速复核。

**Non-Goals:**
- 不追求覆盖所有边界情况；以 smoke/contract 为主，深层逻辑仍由 feature 内单测负责。
- 不在本次引入端到端浏览器自动化（Playwright）；先用手动 DevTools 清单覆盖。

## Decisions

### 1) 以“smoke flows”组织端点级测试
**Decision:** 新增 `backend/py/tests/web/test_api_smoke.py`（或同等命名），按流程组织：
- notebook 创建/列表
- sources 上传/列表/删除（与 error envelope）
- outputs 创建/列表/读取/删除（不触发外部 LLM 的情况下，优先测试 CRUD 与错误码）
- analysis 空 notebook 行为（返回空数组）

**Rationale:** 以最小链路覆盖跨模块契约，成本可控且能快速发现破坏性回归。

### 2) 错误 envelope 断言作为 contract
**Decision:** 为常见错误（422 校验失败、404 not found、400 invalid input）统一断言返回 `{error_code,message,details?}` 形状，并断言 status code。

**Rationale:** 这是跨端/SDK 依赖的稳定契约，应由端点级测试锁定。

### 3) DevTools 验证作为“部署后 smoke”
**Decision:** 在 tasks 中提供一份可重复的 DevTools Network/Console 验证步骤（含可选 curl），覆盖与自动化 smoke flows 对齐的路径。

**Rationale:** 自动化测试运行在 test settings；部署后验证能覆盖真实配置/代理/CORS/SSE 等环境因素。

## Risks / Trade-offs

- **[风险]** smoke flows 若触发真实 AI provider 会变慢/不稳定 → **缓解**：使用 test provider，避免真实外部调用；必要时对相关模块做 mock。
- **[风险]** 测试数量增加导致 CI 变慢 → **缓解**：保持 smoke 测试轻量（只覆盖关键端点与错误 envelope）。

## Migration Plan

- 先落地 smoke tests 与 DevTools 清单；后续每个重大 API 变更在对应 change 中扩展覆盖。
